using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class ManualItemLookupService : IManualItemLookupService
{
    /// <summary>Allowed image extensions → canonical MIME mapping. Same set
    /// as prescription images — keeps validation consistent.</summary>
    private static readonly IReadOnlyDictionary<string, string> AllowedImageTypesByExtension =
      new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
      {
          { ".png", "image/png" },
          { ".jpg", "image/jpeg" },
          { ".jpeg", "image/jpeg" },
          { ".webp", "image/webp" }
      };

    private const string OctetStreamContentType = "application/octet-stream";

    private readonly IAppDbContext _dbContext;
    private readonly IManualLookupImageStorage _imageStorage;
    private readonly IRealtimeUpdatesPublisher _realtimePublisher;
    private readonly ILogger<ManualItemLookupService> _logger;

    public ManualItemLookupService(IAppDbContext dbContext)
      : this(
          dbContext,
          new NullManualLookupImageStorage(),
          new NoOpRealtimeUpdatesPublisher(),
          NullLogger<ManualItemLookupService>.Instance)
    {
    }

    public ManualItemLookupService(
      IAppDbContext dbContext,
      IManualLookupImageStorage imageStorage,
      IRealtimeUpdatesPublisher realtimePublisher,
      ILogger<ManualItemLookupService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(imageStorage);
        ArgumentNullException.ThrowIfNull(realtimePublisher);
        ArgumentNullException.ThrowIfNull(logger);
        _dbContext = dbContext;
        _imageStorage = imageStorage;
        _realtimePublisher = realtimePublisher;
        _logger = logger;
    }

    public async Task<ManualLookupRequestResponse> CreateRequestAsync(
      Guid pharmacistId,
      CreateManualLookupRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");
        if (request.PrescriptionId == Guid.Empty)
            throw new DomainArgumentException("PrescriptionId can't be empty.");

        // Pharmacist composes manual items locally in the draft store —
        // they don't yet exist as persisted PrescriptionChecklistItem rows
        // when the lookup is created. The link runs item → lookup via
        // PrescriptionChecklistItem.LookupRequestId, set at submit time
        // (see PrescriptionService.SubmitChecklistAsync). The lookup just
        // needs the prescription id + the manual name + an optional hint.
        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .FirstOrDefaultAsync(p => p.Id == request.PrescriptionId, cancellationToken)
          ?? throw new InvalidOperationException(
              $"Prescription '{request.PrescriptionId}' was not found.");

        if (prescription.Status != PrescriptionStatus.InReview)
            throw new InvalidOperationException(
              $"Prescription must be InReview to request a lookup; current is {prescription.Status}.");

        if (prescription.AssignedPharmacistId != pharmacistId)
            throw new UnauthorizedAccessException(
              "Only the assigned pharmacist can create lookup requests for this prescription.");

        var lookupRequest = new ManualItemLookupRequest(
          prescriptionId: prescription.Id,
          requestedByPharmacistId: pharmacistId,
          manualMedicineName: request.ManualMedicineName,
          requestComment: request.RequestComment);

        _dbContext.ManualItemLookupRequests.Add(lookupRequest);

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimePublisher.PublishManualLookupRequestCreatedAsync(
          lookupRequest.Id, prescription.Id, pharmacistId, cancellationToken);

        _logger.LogInformation(
          "Manual lookup request {RequestId} created for prescription {PrescriptionId} by pharmacist {PharmacistId}",
          lookupRequest.Id, prescription.Id, pharmacistId);

        return await BuildResponseAsync(lookupRequest.Id, cancellationToken);
    }

    public async Task<IReadOnlyList<ManualLookupRequestResponse>> GetByPrescriptionForPharmacistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");
        if (prescriptionId == Guid.Empty)
            throw new DomainArgumentException("PrescriptionId can't be empty.");

        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .FirstOrDefaultAsync(p => p.Id == prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException(
              $"Prescription '{prescriptionId}' was not found.");

        // Pharmacists can read lookup state for prescriptions they're
        // assigned to, plus already-decoded ones (so they can review past
        // work). Anything in the open queue is fair game too — if they've
        // listed the prescription they need to be able to drill into it.
        var allowed = prescription.Status switch
        {
            PrescriptionStatus.InQueue => true,
            PrescriptionStatus.InReview => prescription.AssignedPharmacistId == pharmacistId,
            PrescriptionStatus.Decoded => prescription.AssignedPharmacistId == pharmacistId,
            _ => false
        };
        if (!allowed)
            throw new UnauthorizedAccessException(
              "Lookup requests for this prescription are not visible to this pharmacist.");

        var rows = await LoadRequestsAsync(
          q => q.Where(r => r.PrescriptionId == prescriptionId)
                .OrderByDescending(r => r.CreatedAtUtc),
          cancellationToken);

        return rows;
    }

    public async Task<ManualLookupRequestResponse> GetByIdForPharmacistAsync(
      Guid pharmacistId,
      Guid requestId,
      CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");
        if (requestId == Guid.Empty)
            throw new DomainArgumentException("RequestId can't be empty.");

        // Authorization mirrors GetByPrescriptionForPharmacistAsync — load
        // the parent prescription and run the same status check.
        var lookup = await _dbContext.ManualItemLookupRequests
          .AsNoTracking()
          .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken)
          ?? throw new InvalidOperationException($"Lookup request '{requestId}' was not found.");

        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .FirstOrDefaultAsync(p => p.Id == lookup.PrescriptionId, cancellationToken)
          ?? throw new InvalidOperationException(
              $"Prescription '{lookup.PrescriptionId}' was not found.");

        var allowed = prescription.Status switch
        {
            PrescriptionStatus.InQueue => true,
            PrescriptionStatus.InReview => prescription.AssignedPharmacistId == pharmacistId,
            PrescriptionStatus.Decoded => prescription.AssignedPharmacistId == pharmacistId,
            _ => false
        };
        if (!allowed)
            throw new UnauthorizedAccessException(
              "Lookup request is not visible to this pharmacist.");

        return await BuildResponseAsync(requestId, cancellationToken);
    }

    public async Task<IReadOnlyList<ManualLookupRequestResponse>> GetActiveForAdminAsync(
      Guid adminId,
      CancellationToken cancellationToken = default)
    {
        await GetAdminOrThrowAsync(adminId, cancellationToken);

        return await LoadRequestsAsync(
          q => q.Where(r => r.Status == ManualItemLookupRequestStatus.Open)
                .OrderByDescending(r => r.CreatedAtUtc),
          cancellationToken);
    }

    public async Task<GetManualLookupHistoryResponse> GetHistoryForAdminAsync(
      Guid adminId,
      GetManualLookupHistoryRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        await GetAdminOrThrowAsync(adminId, cancellationToken);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : Math.Min(request.PageSize, 200);

        var baseQuery = _dbContext.ManualItemLookupRequests
          .AsNoTracking()
          .Where(r => r.Status == ManualItemLookupRequestStatus.Closed);

        var totalCount = await baseQuery.CountAsync(cancellationToken);

        var ids = await baseQuery
          .OrderByDescending(r => r.ClosedAtUtc)
          .ThenByDescending(r => r.CreatedAtUtc)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .Select(r => r.Id)
          .ToListAsync(cancellationToken);

        var requests = await LoadRequestsAsync(
          q => q.Where(r => ids.Contains(r.Id))
                .OrderByDescending(r => r.ClosedAtUtc)
                .ThenByDescending(r => r.CreatedAtUtc),
          cancellationToken);

        return new GetManualLookupHistoryResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Requests = requests
        };
    }

    public async Task<ManualLookupResponseResponse> RespondAsync(
      Guid adminId,
      Guid requestId,
      RespondToManualLookupRequest request,
      ManualLookupImageUpload? image,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (requestId == Guid.Empty)
            throw new DomainArgumentException("RequestId can't be empty.");

        var admin = await GetAdminOrThrowAsync(adminId, cancellationToken);

        var lookup = await _dbContext.ManualItemLookupRequests
          .AsTracking()
          .Include(r => r.Responses)
          .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken)
          ?? throw new InvalidOperationException($"Lookup request '{requestId}' was not found.");

        if (lookup.Status != ManualItemLookupRequestStatus.Open)
            throw new InvalidOperationException(
              $"Cannot respond to a lookup request in status '{lookup.Status}'.");

        var existing = lookup.Responses.FirstOrDefault(r => r.RespondingPharmacyId == admin.PharmacyId);
        var previousImageKey = existing?.ImageKey;

        // Upload first (so we don't write the new key into the aggregate
        // unless storage actually accepted the bytes). If we fail later,
        // best-effort delete the freshly-uploaded blob to avoid orphans.
        string? newImageKey = null;
        if (image is not null)
        {
            var (validated, contentType) = await PrepareValidatedImageForUploadAsync(
              image.Content, image.FileName, image.ContentType, cancellationToken);
            try
            {
                newImageKey = await _imageStorage.UploadAsync(
                  validated, contentType, image.FileName, cancellationToken);
            }
            finally
            {
                validated.Dispose();
            }
        }

        var resolvedImageKey = ResolveImageKey(
          existingKey: previousImageKey,
          newKey: newImageKey,
          clearImage: request.ClearImage);

        try
        {
            var response = lookup.AddOrUpdateResponse(
              respondingPharmacyId: admin.PharmacyId,
              respondingAdminId: adminId,
              fullName: request.FullName,
              price: request.Price,
              quantity: request.Quantity,
              imageKey: resolvedImageKey,
              responseComment: request.ResponseComment);

            // Lookup is tracked (we loaded it AsTracking) and EF picks up
            // the newly-added response through navigation when the
            // collection mutates; updates to an existing response also
            // propagate from the tracked aggregate without explicit
            // Attach calls.
            await _dbContext.SaveChangesAsync(cancellationToken);

            // Once the upsert is durable, drop the previously-stored blob
            // when it was either replaced or explicitly cleared.
            if (!string.IsNullOrEmpty(previousImageKey)
              && previousImageKey != resolvedImageKey)
            {
                await TryDeleteImageAsync(previousImageKey);
            }

            await _realtimePublisher.PublishManualLookupResponseAddedAsync(
              lookup.Id,
              response.Id,
              admin.PharmacyId,
              lookup.RequestedByPharmacistId,
              cancellationToken);

            _logger.LogInformation(
              "Manual lookup response upsert: request {RequestId}, pharmacy {PharmacyId}, admin {AdminId}, qty {Qty}, price {Price}",
              lookup.Id, admin.PharmacyId, adminId, request.Quantity, request.Price);

            return MapResponse(response, respondingPharmacyTitle: null);
        }
        catch
        {
            // We've uploaded the image but failed to persist — reverse
            // the upload so we don't leak storage. Best-effort.
            if (newImageKey is not null && newImageKey != previousImageKey)
                await TryDeleteImageAsync(newImageKey);
            throw;
        }
    }

    public async Task<ManualLookupResponseResponse?> GetMyResponseAsync(
      Guid adminId,
      Guid requestId,
      CancellationToken cancellationToken = default)
    {
        var admin = await GetAdminOrThrowAsync(adminId, cancellationToken);

        var response = await _dbContext.ManualItemLookupResponses
          .AsNoTracking()
          .FirstOrDefaultAsync(
            r => r.RequestId == requestId && r.RespondingPharmacyId == admin.PharmacyId,
            cancellationToken);

        if (response is null) return null;

        var pharmacyTitle = await _dbContext.Pharmacies
          .AsNoTracking()
          .Where(p => p.Id == admin.PharmacyId)
          .Select(p => p.Title)
          .FirstOrDefaultAsync(cancellationToken);

        return MapResponse(response, pharmacyTitle);
    }

    public async Task CloseRequestsForPrescriptionAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (prescriptionId == Guid.Empty)
            throw new DomainArgumentException("PrescriptionId can't be empty.");

        var openRequests = await _dbContext.ManualItemLookupRequests
          .AsTracking()
          .Include(r => r.Responses)
          .Where(r => r.PrescriptionId == prescriptionId
                  && r.Status == ManualItemLookupRequestStatus.Open)
          .ToListAsync(cancellationToken);

        if (openRequests.Count == 0)
            return;

        // Materialise shadow medicines + offers from every response that
        // belongs to a checklist item the pharmacist actually KEPT in the
        // final checklist. We only check existence by lookup_request_id —
        // when the pharmacist drops a manual line during submit, its
        // lookup goes orphaned (still in this list), no shadow rows are
        // created for it, and the request just closes. Idempotent: the
        // unique partial index on medicines.manual_lookup_response_id
        // guards against double-materialisation if this method ever runs
        // twice.
        var lookupIds = openRequests.Select(r => r.Id).ToList();
        var keptItemLookupIds = await _dbContext.PrescriptionChecklistItems
          .AsNoTracking()
          .Where(i => i.PrescriptionId == prescriptionId
                   && i.LookupRequestId != null
                   && lookupIds.Contains(i.LookupRequestId.Value))
          .Select(i => i.LookupRequestId!.Value)
          .ToListAsync(cancellationToken);
        var keptLookupIdSet = keptItemLookupIds.ToHashSet();

        var existingShadowResponseIds = await _dbContext.Medicines
          .AsNoTracking()
          .Where(m => m.ManualLookupResponseId != null
                   && lookupIds.Contains(m.ManualLookupRequestId!.Value))
          .Select(m => m.ManualLookupResponseId!.Value)
          .ToListAsync(cancellationToken);
        var existingShadowSet = existingShadowResponseIds.ToHashSet();

        foreach (var lookup in openRequests)
        {
            if (keptLookupIdSet.Contains(lookup.Id))
                MaterialiseShadowMedicinesForLookup(lookup, existingShadowSet);
            lookup.Close();
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Notify after the durable commit — readers don't need to refresh
        // until the row is actually flipped.
        foreach (var lookup in openRequests)
        {
            await _realtimePublisher.PublishManualLookupRequestClosedAsync(
              lookup.Id, cancellationToken);
        }

        _logger.LogInformation(
          "Closed {Count} manual lookup requests for prescription {PrescriptionId}; materialised shadow rows for {KeptCount} kept items",
          openRequests.Count, prescriptionId, keptLookupIdSet.Count);
    }

    /// <summary>
    /// One shadow Medicine + Offer per response, gated by the per-response
    /// idempotency set. Cheaper than a SELECT-per-row dance and safe since
    /// the only writer is this single close pass.
    /// </summary>
    private void MaterialiseShadowMedicinesForLookup(
      ManualItemLookupRequest lookup,
      HashSet<Guid> alreadyMaterialisedResponseIds)
    {
        foreach (var response in lookup.Responses)
        {
            if (alreadyMaterialisedResponseIds.Contains(response.Id))
                continue;

            var articul = $"manual-{response.Id:N}";
            var shadow = Medicine.ForManualLookup(
              title: response.FullName,
              articul: articul,
              manualLookupRequestId: lookup.Id,
              manualLookupResponseId: response.Id);

            _dbContext.Medicines.Add(shadow);

            // Attach the response photo (if any) as the medicine's main
            // image. Reusing the MinIO key directly — the bucket is
            // shared, only the prefix differs, so the existing
            // medicine-image content endpoint can stream the same blob
            // without a copy.
            if (!string.IsNullOrEmpty(response.ImageKey))
            {
                var image = new MedicineImage(
                  medicineId: shadow.Id,
                  key: response.ImageKey,
                  isMain: true,
                  isMinimal: false);
                _dbContext.MedicineImages.Add(image);
            }

            var offer = new Offer(
              medicineId: shadow.Id,
              pharmacyId: response.RespondingPharmacyId,
              stockQuantity: response.Quantity,
              price: response.Price);
            _dbContext.Offers.Add(offer);

            alreadyMaterialisedResponseIds.Add(response.Id);
        }
    }

    private async Task<PharmacyWorker> GetAdminOrThrowAsync(
      Guid adminId,
      CancellationToken cancellationToken)
    {
        if (adminId == Guid.Empty)
            throw new DomainArgumentException("AdminId can't be empty.");

        var admin = await _dbContext.PharmacyWorkers
          .AsNoTracking()
          .FirstOrDefaultAsync(w => w.Id == adminId, cancellationToken)
          ?? throw new InvalidOperationException($"PharmacyWorker '{adminId}' was not found.");

        if (admin.Role != Role.Admin)
            throw new UnauthorizedAccessException(
              $"PharmacyWorker '{adminId}' is not an Admin.");

        return admin;
    }

    private async Task<IReadOnlyList<ManualLookupRequestResponse>> LoadRequestsAsync(
      Func<IQueryable<ManualItemLookupRequest>, IQueryable<ManualItemLookupRequest>> shape,
      CancellationToken cancellationToken)
    {
        var query = _dbContext.ManualItemLookupRequests.AsNoTracking().Include(r => r.Responses);
        var rows = await shape(query).ToListAsync(cancellationToken);
        if (rows.Count == 0)
            return Array.Empty<ManualLookupRequestResponse>();

        var pharmacyIds = rows
          .SelectMany(r => r.Responses)
          .Select(r => r.RespondingPharmacyId)
          .Distinct()
          .ToList();
        var pharmacistIds = rows.Select(r => r.RequestedByPharmacistId).Distinct().ToList();

        var pharmacyTitles = pharmacyIds.Count == 0
          ? new Dictionary<Guid, string>()
          : await _dbContext.Pharmacies
              .AsNoTracking()
              .Where(p => pharmacyIds.Contains(p.Id))
              .Select(p => new { p.Id, p.Title })
              .ToDictionaryAsync(p => p.Id, p => p.Title, cancellationToken);

        var pharmacistNames = pharmacistIds.Count == 0
          ? new Dictionary<Guid, string?>()
          : await _dbContext.Pharmacists
              .AsNoTracking()
              .Where(p => pharmacistIds.Contains(p.Id))
              .Select(p => new { p.Id, p.Name })
              .ToDictionaryAsync(p => p.Id, p => (string?)p.Name, cancellationToken);

        return rows.Select(r => MapRequest(r, pharmacyTitles, pharmacistNames)).ToList();
    }

    private async Task<ManualLookupRequestResponse> BuildResponseAsync(
      Guid requestId,
      CancellationToken cancellationToken)
    {
        var rows = await LoadRequestsAsync(
          q => q.Where(r => r.Id == requestId),
          cancellationToken);
        return rows[0];
    }

    private static ManualLookupRequestResponse MapRequest(
      ManualItemLookupRequest request,
      IReadOnlyDictionary<Guid, string> pharmacyTitles,
      IReadOnlyDictionary<Guid, string?> pharmacistNames)
    {
        return new ManualLookupRequestResponse
        {
            Id = request.Id,
            PrescriptionId = request.PrescriptionId,
            RequestedByPharmacistId = request.RequestedByPharmacistId,
            RequestedByPharmacistName = pharmacistNames.TryGetValue(request.RequestedByPharmacistId, out var name) ? name : null,
            ManualMedicineName = request.ManualMedicineName,
            RequestComment = request.RequestComment,
            Status = request.Status.ToString(),
            CreatedAtUtc = request.CreatedAtUtc,
            ClosedAtUtc = request.ClosedAtUtc,
            Responses = request.Responses
              .OrderBy(r => r.CreatedAtUtc)
              .Select(r => MapResponse(
                  r,
                  pharmacyTitles.TryGetValue(r.RespondingPharmacyId, out var title) ? title : null))
              .ToList()
        };
    }

    private static ManualLookupResponseResponse MapResponse(
      ManualItemLookupResponse response,
      string? respondingPharmacyTitle)
    {
        return new ManualLookupResponseResponse
        {
            Id = response.Id,
            RequestId = response.RequestId,
            RespondingPharmacyId = response.RespondingPharmacyId,
            RespondingPharmacyTitle = respondingPharmacyTitle,
            RespondingAdminId = response.RespondingAdminId,
            FullName = response.FullName,
            Price = response.Price,
            Quantity = response.Quantity,
            ImageUrl = string.IsNullOrEmpty(response.ImageKey)
              ? null
              : $"/api/manual-lookups/responses/{response.Id}/image",
            ResponseComment = response.ResponseComment,
            CreatedAtUtc = response.CreatedAtUtc,
            UpdatedAtUtc = response.UpdatedAtUtc
        };
    }

    private static string? ResolveImageKey(string? existingKey, string? newKey, bool clearImage)
    {
        // Precedence: a newly-uploaded blob always wins. Otherwise honour
        // the explicit "clear image" flag. Otherwise keep what was there.
        if (newKey is not null) return newKey;
        if (clearImage) return null;
        return existingKey;
    }

    private async Task TryDeleteImageAsync(string key)
    {
        try
        {
            await _imageStorage.DeleteAsync(key, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
              "Failed to delete orphan manual-lookup image with key {Key}", key);
        }
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
            if (read <= 0) break;

            totalRead += read;
            if (totalRead > UserInputPolicy.MaxMedicineImageFileSizeBytes)
                throw new InvalidOperationException("Manual lookup image is too large.");

            await memory.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        if (totalRead == 0)
            throw new InvalidOperationException("Manual lookup image is empty.");

        var imageBytes = memory.GetBuffer().AsSpan(0, (int)memory.Length);
        if (!IsSupportedImageSignature(extension, imageBytes))
            throw new InvalidOperationException("Unsupported manual lookup image content.");

        memory.Position = 0;
        return (memory, resolvedContentType);
    }

    private static string ValidateAndResolveContentType(string fileName, string contentType)
    {
        var extension = Path.GetExtension(fileName).Trim();
        if (string.IsNullOrWhiteSpace(extension)
            || !AllowedImageTypesByExtension.TryGetValue(extension, out var expectedContentType))
            throw new InvalidOperationException("Unsupported manual lookup image extension.");

        var normalizedContentType = contentType.Trim().ToLowerInvariant();
        if (!string.Equals(normalizedContentType, OctetStreamContentType, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(normalizedContentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
              "Manual lookup image content type does not match its extension.");
        }

        return expectedContentType;
    }

    private static bool IsSupportedImageSignature(string extension, ReadOnlySpan<byte> bytes)
    {
        if (string.Equals(extension, ".png", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 8
              && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
              && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A;
        }

        if (string.Equals(extension, ".jpg", StringComparison.OrdinalIgnoreCase)
            || string.Equals(extension, ".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 3
              && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        }

        if (string.Equals(extension, ".webp", StringComparison.OrdinalIgnoreCase))
        {
            return bytes.Length >= 12
              && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
              && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P';
        }

        return false;
    }

    /// <summary>Test-only fallback used by the parameterless ctor so the
    /// in-memory test harness can spin up the service without wiring a
    /// MinIO container. Real callers always inject the live storage.</summary>
    private sealed class NullManualLookupImageStorage : IManualLookupImageStorage
    {
        public Task<ManualLookupImageContent> GetContentAsync(string key, CancellationToken cancellationToken = default)
            => throw new NotSupportedException("Image storage is not configured in the test ctor.");

        public Task<string> UploadAsync(Stream content, string contentType, string fileName, CancellationToken cancellationToken = default)
            => throw new NotSupportedException("Image storage is not configured in the test ctor.");

        public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }
}
