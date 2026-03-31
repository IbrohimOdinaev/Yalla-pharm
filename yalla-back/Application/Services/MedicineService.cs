using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class MedicineService : IMedicineService
{
    private const string OctetStreamContentType = "application/octet-stream";
    private static readonly IReadOnlyDictionary<string, string> AllowedImageTypesByExtension =
      new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
      {
          [".png"] = "image/png",
          [".jpg"] = "image/jpeg",
          [".jpeg"] = "image/jpeg",
          [".webp"] = "image/webp"
      };

    private readonly IAppDbContext _dbContext;
    private readonly IMedicineImageStorage _medicineImageStorage;

    public MedicineService(IAppDbContext dbContext)
      : this(dbContext, NullMedicineImageStorage.Instance)
    {
    }

    public MedicineService(
      IAppDbContext dbContext,
      IMedicineImageStorage medicineImageStorage)
    {
        _dbContext = dbContext;
        _medicineImageStorage = medicineImageStorage;
    }

    public async Task<CreateMedicineResponse> CreateMedicineAsync(
      CreateMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var articul = request.Articul?.Trim();
        if (!string.IsNullOrWhiteSpace(articul))
        {
            var articulExists = await _dbContext.Medicines
              .AnyAsync(x => x.Articul == articul, cancellationToken);

            if (articulExists)
                throw new InvalidOperationException($"Medicine with articul '{articul}' already exists.");
        }

        var medicine = request.ToDomain();

        _dbContext.Medicines.Add(medicine);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateMedicineResponse
        {
            Medicine = medicine.ToResponse()
        };
    }

    public async Task<UpdateMedicineResponse> UpdateMedicineAsync(
      UpdateMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var articul = request.Articul?.Trim();
        if (!string.IsNullOrWhiteSpace(articul))
        {
            var articulExists = await _dbContext.Medicines
              .AnyAsync(x => x.Articul == articul && x.Id != request.MedicineId, cancellationToken);

            if (articulExists)
                throw new InvalidOperationException($"Medicine with articul '{articul}' already exists.");
        }

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .Include(x => x.Atributes)
          .Include(x => x.Images)
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        request.ApplyToDomain(medicine);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UpdateMedicineResponse
        {
            Medicine = medicine.ToResponse()
        };
    }

    public async Task<DeleteMedicineResponse> DeleteMedicineAsync(
      DeleteMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .Include(x => x.Images)
          .Include(x => x.Offers)
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        if (!request.Permanently)
        {
            medicine.SetIsActive(false);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new DeleteMedicineResponse
            {
                MedicineId = request.MedicineId,
                IsActive = medicine.IsActive
            };
        }

        var hasOrderPositions = await _dbContext.OrderPositions
          .AsNoTracking()
          .AnyAsync(x => x.MedicineId == request.MedicineId, cancellationToken);

        if (hasOrderPositions)
        {
            throw new InvalidOperationException(
              $"Medicine '{request.MedicineId}' cannot be permanently deleted because it is used in order history.");
        }

        var imageKeys = medicine.Images
          .Select(x => x.Key)
          .Where(x => !string.IsNullOrWhiteSpace(x))
          .Distinct(StringComparer.Ordinal)
          .ToList();

        foreach (var imageKey in imageKeys)
            await _medicineImageStorage.DeleteAsync(imageKey, cancellationToken);

        var basketPositions = await _dbContext.BasketPositions
          .AsTracking()
          .Where(x => x.MedicineId == request.MedicineId)
          .ToListAsync(cancellationToken);

        if (basketPositions.Count > 0)
            _dbContext.BasketPositions.RemoveRange(basketPositions);

        if (medicine.Offers.Count > 0)
            _dbContext.Offers.RemoveRange(medicine.Offers);

        if (medicine.Images.Count > 0)
            _dbContext.MedicineImages.RemoveRange(medicine.Images);

        _dbContext.Medicines.Remove(medicine);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeleteMedicineResponse
        {
            MedicineId = request.MedicineId,
            IsActive = false
        };
    }

    public async Task<GetMedicinesCatalogResponse> GetMedicinesCatalogAsync(
      GetMedicinesCatalogRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var query = _dbContext.Medicines
          .AsNoTracking()
          .Where(x => x.IsActive)
          .Where(x => x.Offers.Any(o => o.StockQuantity > 0));

        if (request.CategoryId.HasValue)
        {
            var catId = request.CategoryId.Value;
            query = query.Where(x =>
                x.CategoryId == catId
                || x.Category!.ParentId == catId);
        }

        var normalizedQuery = (request.Query ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(normalizedQuery))
        {
            var searchPattern = $"%{normalizedQuery.ToLower()}%";
            query = query.Where(x =>
              EF.Functions.Like(x.Title.ToLower(), searchPattern)
              || EF.Functions.Like(x.Articul.ToLower(), searchPattern));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var medicines = await query
          .OrderBy(x => x.Title)
          .ThenBy(x => x.Articul)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .Include(x => x.Images)
          .Select(x => new MedicineSearchItemResponse
          {
              Id = x.Id,
              Title = x.Title,
              Articul = x.Articul,
              IsActive = x.IsActive,
              CategoryName = x.Category != null ? x.Category.Name : null,
              MinPrice = x.Offers.Any(o => o.Price > 0)
                ? x.Offers.Where(o => o.Price > 0).Min(o => o.Price)
                : null,
              Images = x.Images
                .OrderByDescending(i => i.IsMain)
                .ThenByDescending(i => i.IsMinimal)
                .Select(i => new MedicineImageResponse
                {
                    Id = i.Id,
                    Key = i.Key,
                    IsMain = i.IsMain,
                    IsMinimal = i.IsMinimal
                })
                .ToList()
          })
          .ToListAsync(cancellationToken);

        return new GetMedicinesCatalogResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Medicines = medicines
        };
    }

    public async Task<GetAllMedicinesResponse> GetAllMedicinesAsync(
      GetAllMedicinesRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var query = _dbContext.Medicines
          .AsNoTracking()
          .AsQueryable();

        if (request.IsActive.HasValue)
            query = query.Where(x => x.IsActive == request.IsActive.Value);

        if (request.CategoryId.HasValue)
        {
            var catId = request.CategoryId.Value;
            query = query.Where(x =>
                x.CategoryId == catId
                || x.Category!.ParentId == catId);
        }

        var normalizedQuery = (request.Query ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(normalizedQuery))
        {
            var searchPattern = $"%{normalizedQuery.ToLower()}%";
            query = query.Where(x =>
              EF.Functions.Like(x.Title.ToLower(), searchPattern)
              || EF.Functions.Like(x.Articul.ToLower(), searchPattern));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var medicines = await query
          .OrderBy(x => x.Title)
          .ThenBy(x => x.Articul)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .Include(x => x.Images)
          .Select(x => new MedicineSearchItemResponse
          {
              Id = x.Id,
              Title = x.Title,
              Articul = x.Articul,
              IsActive = x.IsActive,
              CategoryName = x.Category != null ? x.Category.Name : null,
              MinPrice = x.Offers.Any(o => o.Price > 0)
                ? x.Offers.Where(o => o.Price > 0).Min(o => o.Price)
                : null,
              Images = x.Images
                .OrderByDescending(i => i.IsMain)
                .ThenByDescending(i => i.IsMinimal)
                .Select(i => new MedicineImageResponse
                {
                    Id = i.Id,
                    Key = i.Key,
                    IsMain = i.IsMain,
                    IsMinimal = i.IsMinimal
                })
                .ToList()
          })
          .ToListAsync(cancellationToken);

        return new GetAllMedicinesResponse
        {
            IsActive = request.IsActive,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Medicines = medicines
        };
    }

    public async Task<GetMedicineByIdResponse> GetMedicineByIdAsync(
      GetMedicineByIdRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.MedicineId == Guid.Empty)
            throw new InvalidOperationException("MedicineId can't be empty.");

        var medicine = await _dbContext.Medicines
          .AsNoTracking()
          .Include(x => x.Atributes)
          .Include(x => x.Images)
          .Include(x => x.Category)
          .FirstOrDefaultAsync(
            x => x.Id == request.MedicineId && (request.IncludeInactive || x.IsActive),
            cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        var offers = await BuildMedicineOffersAsync(request.MedicineId, cancellationToken);

        return new GetMedicineByIdResponse
        {
            Medicine = medicine.ToResponse(offers)
        };
    }

    public async Task<SearchMedicinesResponse> SearchMedicinesAsync(
      SearchMedicinesRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = (request.Query ?? string.Empty).Trim();
        var limit = NormalizeSearchLimit(request.Limit);

        if (string.IsNullOrWhiteSpace(query))
        {
            return new SearchMedicinesResponse
            {
                Query = query,
                Limit = limit,
                Medicines = []
            };
        }

        var normalizedQuery = query.ToLower();
        var prefixPattern = $"{normalizedQuery}%";
        var containsPattern = $"%{normalizedQuery}%";

        var ranked = await _dbContext.Medicines
          .AsNoTracking()
          .Where(x =>
            x.IsActive &&
            x.Offers.Any(o => o.StockQuantity > 0) &&
            (EF.Functions.Like(x.Title.ToLower(), containsPattern)
             || EF.Functions.Like(x.Articul.ToLower(), containsPattern)))
          .Select(x => new
          {
              x.Id,
              x.Title,
              x.Articul,
              TitleStarts = EF.Functions.Like(x.Title.ToLower(), prefixPattern),
              ArticulStarts = EF.Functions.Like(x.Articul.ToLower(), prefixPattern),
              TitleContains = EF.Functions.Like(x.Title.ToLower(), containsPattern),
              ArticulContains = EF.Functions.Like(x.Articul.ToLower(), containsPattern)
          })
          .OrderByDescending(x => x.TitleStarts)
          .ThenByDescending(x => x.ArticulStarts)
          .ThenByDescending(x => x.TitleContains)
          .ThenByDescending(x => x.ArticulContains)
          .ThenBy(x => x.Title)
          .Take(limit)
          .ToListAsync(cancellationToken);

        var medicineIds = ranked.Select(x => x.Id).Distinct().ToList();

        var images = await _dbContext.MedicineImages
          .AsNoTracking()
          .Where(x => medicineIds.Contains(x.MedicineId))
          .OrderByDescending(x => x.IsMain)
          .ThenByDescending(x => x.IsMinimal)
          .Select(x => new
          {
              x.MedicineId,
              Image = new MedicineImageResponse
              {
                  Id = x.Id,
                  Key = x.Key,
                  IsMain = x.IsMain,
                  IsMinimal = x.IsMinimal
              }
          })
          .ToListAsync(cancellationToken);

        var imagesByMedicineId = images
          .GroupBy(x => x.MedicineId)
          .ToDictionary(x => x.Key, x => (IReadOnlyCollection<MedicineImageResponse>)x.Select(y => y.Image).ToList());

        var minPrices = await _dbContext.Offers
          .AsNoTracking()
          .Where(x => medicineIds.Contains(x.MedicineId) && x.Price > 0)
          .GroupBy(x => x.MedicineId)
          .Select(g => new { MedicineId = g.Key, MinPrice = g.Min(x => x.Price) })
          .ToDictionaryAsync(x => x.MedicineId, x => x.MinPrice, cancellationToken);

        return new SearchMedicinesResponse
        {
            Query = query,
            Limit = limit,
            Medicines = ranked
              .Select(x => new MedicineSearchItemResponse
              {
                  Id = x.Id,
                  Title = x.Title,
                  Articul = x.Articul,
                  IsActive = true,
                  MinPrice = minPrices.TryGetValue(x.Id, out var mp) ? mp : null,
                  Images = imagesByMedicineId.TryGetValue(x.Id, out var value)
                    ? value
                    : []
              })
              .ToList()
        };
    }

    public async Task<string> GetMedicineImageUrlAsync(
      Guid medicineImageId,
      CancellationToken cancellationToken = default)
    {
        var imageKey = await ResolveImageKeyAsync(medicineImageId, cancellationToken);

        return await _medicineImageStorage.GetUrlAsync(imageKey, cancellationToken);
    }

    public async Task<MedicineImageContent> GetMedicineImageContentAsync(
      Guid medicineImageId,
      CancellationToken cancellationToken = default)
    {
        var imageKey = await ResolveImageKeyAsync(medicineImageId, cancellationToken);
        return await _medicineImageStorage.GetContentAsync(imageKey, cancellationToken);
    }

    public async Task<CreateMedicineImageResponse> CreateMedicineImageAsync(
      CreateMedicineImageRequest request,
      Stream imageContent,
      string fileName,
      string contentType,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(imageContent);

        if (request.MedicineId == Guid.Empty)
            throw new InvalidOperationException("MedicineId can't be empty.");

        if (request.IsMain is null)
            throw new InvalidOperationException("IsMain is required.");

        if (request.IsMinimal is null)
            throw new InvalidOperationException("IsMinimal is required.");

        if (string.IsNullOrWhiteSpace(fileName))
            throw new InvalidOperationException("Image file name is required.");

        if (string.IsNullOrWhiteSpace(contentType))
            throw new InvalidOperationException("Image content type is required.");

        var preparedImage = await PrepareValidatedImageForUploadAsync(
          imageContent,
          fileName,
          contentType,
          cancellationToken);

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .Include(x => x.Images)
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        EnsureImageFlagsAreAvailable(medicine, request.IsMain.Value, request.IsMinimal.Value);

        await using var uploadStream = preparedImage.Stream;
        var imageKey = await _medicineImageStorage.UploadAsync(
          uploadStream,
          preparedImage.ContentType,
          fileName,
          cancellationToken);

        var medicineImage = new MedicineImage(
          request.MedicineId,
          imageKey,
          request.IsMain.Value,
          request.IsMinimal.Value);

        medicine.AddImage(medicineImage);
        _dbContext.MedicineImages.Add(medicineImage);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            try
            {
                await _medicineImageStorage.DeleteAsync(imageKey, cancellationToken);
            }
            catch
            {
            }

            throw;
        }

        return new CreateMedicineImageResponse
        {
            MedicineImage = medicineImage.ToResponse()
        };
    }

    public async Task<DeleteMedicineImageResponse> DeleteMedicineImageAsync(
      DeleteMedicineImageRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.MedicineId == Guid.Empty)
            throw new InvalidOperationException("MedicineId can't be empty.");

        if (request.MedicineImageId == Guid.Empty)
            throw new InvalidOperationException("MedicineImageId can't be empty.");

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .Include(x => x.Images)
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        var image = medicine.Images.FirstOrDefault(x => x.Id == request.MedicineImageId)
          ?? throw new InvalidOperationException(
            $"MedicineImage with id '{request.MedicineImageId}' was not found for medicine '{request.MedicineId}'.");

        var imageKey = image.Key;

        medicine.RemoveImage(image);
        _dbContext.MedicineImages.Remove(image);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _medicineImageStorage.DeleteAsync(imageKey, cancellationToken);

        return new DeleteMedicineImageResponse
        {
            MedicineId = request.MedicineId,
            MedicineImageId = request.MedicineImageId
        };
    }

    private static void EnsureImageFlagsAreAvailable(Medicine medicine, bool isMain, bool isMinimal)
    {
        if (isMain && medicine.Images.Any(x => x.IsMain))
            throw new InvalidOperationException($"Medicine '{medicine.Id}' already has a main image.");

        if (isMinimal && medicine.Images.Any(x => x.IsMinimal))
            throw new InvalidOperationException($"Medicine '{medicine.Id}' already has a minimal image.");
    }

    private static string ValidateAndResolveContentType(string fileName, string contentType)
    {
        var extension = Path.GetExtension(fileName).Trim();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedImageTypesByExtension.TryGetValue(extension, out var expectedContentType))
            throw new InvalidOperationException("Unsupported image file extension.");

        var normalizedContentType = contentType.Trim().ToLowerInvariant();
        if (!string.Equals(normalizedContentType, OctetStreamContentType, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(normalizedContentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Image content type does not match file extension.");
        }

        return expectedContentType;
    }

    private static bool IsSupportedImageSignature(string extension, ReadOnlySpan<byte> bytes)
    {
        if (string.Equals(extension, ".png", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 8
              && bytes[0] == 0x89
              && bytes[1] == 0x50
              && bytes[2] == 0x4E
              && bytes[3] == 0x47
              && bytes[4] == 0x0D
              && bytes[5] == 0x0A
              && bytes[6] == 0x1A
              && bytes[7] == 0x0A;
        }

        if (string.Equals(extension, ".jpg", StringComparison.OrdinalIgnoreCase)
            || string.Equals(extension, ".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 3
              && bytes[0] == 0xFF
              && bytes[1] == 0xD8
              && bytes[2] == 0xFF;
        }

        if (string.Equals(extension, ".webp", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 12
              && bytes[0] == (byte)'R'
              && bytes[1] == (byte)'I'
              && bytes[2] == (byte)'F'
              && bytes[3] == (byte)'F'
              && bytes[8] == (byte)'W'
              && bytes[9] == (byte)'E'
              && bytes[10] == (byte)'B'
              && bytes[11] == (byte)'P';
        }

        return false;
    }

    private static async Task<(MemoryStream Stream, string ContentType)> PrepareValidatedImageForUploadAsync(
      Stream imageContent,
      string fileName,
      string contentType,
      CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName).Trim();
        var resolvedContentType = ValidateAndResolveContentType(fileName, contentType);

        if (imageContent.CanSeek)
            imageContent.Position = 0;

        var memory = new MemoryStream();
        var buffer = new byte[81920];
        long totalRead = 0;

        while (true)
        {
            var read = await imageContent.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
            if (read <= 0)
                break;

            totalRead += read;
            if (totalRead > UserInputPolicy.MaxMedicineImageFileSizeBytes)
                throw new InvalidOperationException("Image file is too large.");

            await memory.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        if (totalRead == 0)
            throw new InvalidOperationException("Image file is empty.");

        var imageBytes = memory.GetBuffer().AsSpan(0, (int)memory.Length);
        if (!IsSupportedImageSignature(extension, imageBytes))
            throw new InvalidOperationException("Unsupported image content.");

        memory.Position = 0;
        return (memory, resolvedContentType);
    }

    private static int NormalizeSearchLimit(int limit)
    {
        if (limit <= 0)
            return 20;

        return Math.Min(limit, 50);
    }

    private async Task<string> ResolveImageKeyAsync(
      Guid medicineImageId,
      CancellationToken cancellationToken)
    {
        if (medicineImageId == Guid.Empty)
            throw new InvalidOperationException("MedicineImageId can't be empty.");

        return await _dbContext.MedicineImages
          .AsNoTracking()
          .Where(x => x.Id == medicineImageId)
          .Select(x => x.Key)
          .FirstOrDefaultAsync(cancellationToken)
          ?? throw new InvalidOperationException($"MedicineImage with id '{medicineImageId}' was not found.");
    }

    private async Task<IReadOnlyCollection<MedicineOfferResponse>> BuildMedicineOffersAsync(
      Guid medicineId,
      CancellationToken cancellationToken)
    {
        return await (
          from offer in _dbContext.Offers.AsNoTracking()
          join pharmacy in _dbContext.Pharmacies.AsNoTracking()
            on offer.PharmacyId equals pharmacy.Id
          where offer.MedicineId == medicineId
          orderby pharmacy.Title
          select new MedicineOfferResponse
          {
              OfferId = offer.Id,
              PharmacyId = offer.PharmacyId,
              PharmacyTitle = pharmacy.Title,
              PharmacyIsActive = pharmacy.IsActive,
              StockQuantity = offer.StockQuantity,
              Price = offer.Price,
              IsAvailable = pharmacy.IsActive && offer.StockQuantity > 0
          }).ToListAsync(cancellationToken);
    }

    private sealed class NullMedicineImageStorage : IMedicineImageStorage
    {
        public static readonly NullMedicineImageStorage Instance = new();

        public Task<MedicineImageContent> GetContentAsync(
          string key,
          CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new MedicineImageContent
            {
                Content = new MemoryStream(Array.Empty<byte>()),
                ContentType = OctetStreamContentType
            });
        }

        public Task<string> UploadAsync(
          Stream content,
          string contentType,
          string fileName,
          CancellationToken cancellationToken = default)
        {
            return Task.FromResult($"local/{Guid.NewGuid():N}");
        }

        public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<string> GetUrlAsync(string key, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(key);
        }
    }
}
