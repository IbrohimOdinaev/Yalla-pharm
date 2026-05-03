using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class PrescriptionService : IPrescriptionService
{
    private const string OctetStreamContentType = "application/octet-stream";

    /// <summary>Allowed image extensions → canonical MIME mapping.</summary>
    private static readonly IReadOnlyDictionary<string, string> AllowedImageTypesByExtension =
      new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
      {
          { ".png", "image/png" },
          { ".jpg", "image/jpeg" },
          { ".jpeg", "image/jpeg" },
          { ".webp", "image/webp" }
      };

    private readonly IAppDbContext _dbContext;
    private readonly IPrescriptionImageStorage _imageStorage;

    public PrescriptionService(
      IAppDbContext dbContext,
      IPrescriptionImageStorage imageStorage)
    {
        _dbContext = dbContext;
        _imageStorage = imageStorage;
    }

    public async Task<PrescriptionResponse> CreatePrescriptionAsync(
      Guid clientId,
      CreatePrescriptionRequest request,
      IReadOnlyList<PrescriptionImageUpload> images,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(images);

        if (clientId == Guid.Empty)
            throw new InvalidOperationException("ClientId can't be empty.");

        if (images.Count < Prescription.MinImagesPerPrescription)
            throw new InvalidOperationException(
              $"At least {Prescription.MinImagesPerPrescription} photo is required.");

        if (images.Count > Prescription.MaxImagesPerPrescription)
            throw new InvalidOperationException(
              $"At most {Prescription.MaxImagesPerPrescription} photos are allowed per prescription.");

        // Upload every photo first; if any of them fails we don't want a
        // half-attached Prescription row in the DB.
        var uploadedKeys = new List<string>(images.Count);
        try
        {
            for (var i = 0; i < images.Count; i++)
            {
                var image = images[i];

                if (image.Length <= 0)
                    throw new InvalidOperationException("Prescription image is empty.");

                if (image.Length > UserInputPolicy.MaxMedicineImageFileSizeBytes)
                    throw new InvalidOperationException(
                      $"Prescription image is too large. Maximum allowed size is {UserInputPolicy.MaxMedicineImageFileSizeBytes / (1024 * 1024)} MB.");

                var (validated, contentType) = await PrepareValidatedImageForUploadAsync(
                  image.Content,
                  image.FileName,
                  image.ContentType,
                  cancellationToken);

                try
                {
                    var key = await _imageStorage.UploadAsync(
                      validated,
                      contentType,
                      image.FileName,
                      cancellationToken);
                    uploadedKeys.Add(key);
                }
                finally
                {
                    validated.Dispose();
                }
            }

            var prescriptionImages = uploadedKeys
              .Select((key, idx) => new PrescriptionImage(key, idx))
              .ToList();

            var prescription = new Prescription(
              clientId,
              request.PatientAge,
              request.ClientComment,
              prescriptionImages);

            _dbContext.Prescriptions.Add(prescription);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return await BuildResponseAsync(prescription.Id, cancellationToken)
              ?? throw new InvalidOperationException("Failed to load created prescription.");
        }
        catch
        {
            // Best-effort cleanup of any objects we managed to upload before
            // the failure. Storage failures here are swallowed — the original
            // exception is what the caller cares about.
            foreach (var key in uploadedKeys)
            {
                try { await _imageStorage.DeleteAsync(key, CancellationToken.None); }
                catch { /* ignore */ }
            }
            throw;
        }
    }

    public async Task<IReadOnlyList<PrescriptionResponse>> GetMyPrescriptionsAsync(
      Guid clientId,
      CancellationToken cancellationToken = default)
    {
        if (clientId == Guid.Empty)
            throw new InvalidOperationException("ClientId can't be empty.");

        var prescriptions = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.ClientId == clientId)
          .OrderByDescending(x => x.CreatedAtUtc)
          .Include(x => x.Images)
          .Include(x => x.Items)
          .ToListAsync(cancellationToken);

        return prescriptions.Select(MapToResponse).ToList();
    }

    private async Task<PrescriptionResponse?> BuildResponseAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.Id == prescriptionId)
          .Include(x => x.Images)
          .Include(x => x.Items)
          .FirstOrDefaultAsync(cancellationToken);

        return prescription is null ? null : MapToResponse(prescription);
    }

    private static PrescriptionResponse MapToResponse(Prescription prescription)
    {
        return new PrescriptionResponse
        {
            PrescriptionId = prescription.Id,
            Status = prescription.Status.ToString(),
            PatientAge = prescription.PatientAge,
            ClientComment = prescription.ClientComment,
            CreatedAtUtc = prescription.CreatedAtUtc,
            UpdatedAtUtc = prescription.UpdatedAtUtc,
            DecodedAtUtc = prescription.DecodedAtUtc,
            PharmacistOverallComment = prescription.PharmacistOverallComment,
            AssignedPharmacistId = prescription.AssignedPharmacistId,
            OrderId = prescription.OrderId,
            PaymentIntentId = prescription.PaymentIntentId,
            Images = prescription.Images
              .OrderBy(x => x.OrderIndex)
              .Select(x => new PrescriptionImageResponse
              {
                  Id = x.Id,
                  OrderIndex = x.OrderIndex,
                  // Resolved later by the controller layer (which knows the
                  // public host); kept as the storage key here so the
                  // response is host-agnostic.
                  Url = $"/api/prescriptions/images/{x.Id}/content"
              })
              .ToList(),
            Items = prescription.Items
              .Select(x => new PrescriptionChecklistItemResponse
              {
                  Id = x.Id,
                  MedicineId = x.MedicineId,
                  ManualMedicineName = x.ManualMedicineName,
                  Quantity = x.Quantity,
                  PharmacistComment = x.PharmacistComment
              })
              .ToList()
        };
    }

    private static string ValidateAndResolveContentType(string fileName, string contentType)
    {
        var extension = Path.GetExtension(fileName).Trim();
        if (string.IsNullOrWhiteSpace(extension)
            || !AllowedImageTypesByExtension.TryGetValue(extension, out var expectedContentType))
            throw new InvalidOperationException("Unsupported prescription image extension.");

        var normalizedContentType = contentType.Trim().ToLowerInvariant();
        if (!string.Equals(normalizedContentType, OctetStreamContentType, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(normalizedContentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
              "Prescription image content type does not match its extension.");
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
                throw new InvalidOperationException("Prescription image is too large.");

            await memory.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        if (totalRead == 0)
            throw new InvalidOperationException("Prescription image is empty.");

        var imageBytes = memory.GetBuffer().AsSpan(0, (int)memory.Length);
        if (!IsSupportedImageSignature(extension, imageBytes))
            throw new InvalidOperationException("Unsupported prescription image content.");

        memory.Position = 0;
        return (memory, resolvedContentType);
    }
}
