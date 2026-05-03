using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PrescriptionService : IPrescriptionService
{
    /// <summary>Flat 3 TJS service fee for prescription decoding.</summary>
    public const decimal DecodingFeeAmount = 3m;
    public const string DecodingFeeCurrency = "TJS";

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
    private readonly IPaymentSettingsService _paymentSettingsService;
    private readonly DushanbeCityPaymentOptions _paymentOptions;

    public PrescriptionService(
      IAppDbContext dbContext,
      IPrescriptionImageStorage imageStorage,
      IPaymentSettingsService paymentSettingsService,
      IOptions<DushanbeCityPaymentOptions> paymentOptions)
    {
        _dbContext = dbContext;
        _imageStorage = imageStorage;
        _paymentSettingsService = paymentSettingsService;
        _paymentOptions = paymentOptions.Value;
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

            // Stay in Submitted until the client confirms they paid the
            // 3 TJS DC fee. After payment they hit POST /i-paid which
            // moves the prescription to AwaitingConfirmation; SuperAdmin
            // then verifies the bank receipt and pushes it to InQueue.
            _dbContext.Prescriptions.Add(prescription);
            await _dbContext.SaveChangesAsync(cancellationToken);

            // Build a one-shot DC payment URL so the client can be
            // redirected to pay the 3 TJS fee right after upload. The URL
            // is not stored — caller is expected to redirect immediately.
            var clientPhone = await _dbContext.Clients
              .AsNoTracking()
              .Where(c => c.Id == clientId)
              .Select(c => c.PhoneNumber)
              .FirstOrDefaultAsync(cancellationToken)
              ?? string.Empty;

            var paymentUrl = await BuildPaymentUrlAsync(
              clientPhone,
              prescription.Id,
              cancellationToken);

            var response = await BuildResponseAsync(prescription.Id, cancellationToken)
              ?? throw new InvalidOperationException("Failed to load created prescription.");

            response.PaymentUrl = paymentUrl;
            response.PaymentAmount = DecodingFeeAmount;
            response.PaymentCurrency = DecodingFeeCurrency;
            return response;
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

    public async Task<PrescriptionResponse> MarkPaidByClientAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (clientId == Guid.Empty) throw new InvalidOperationException("ClientId can't be empty.");

        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        if (prescription.ClientId != clientId)
            throw new UnauthorizedAccessException("Prescription belongs to a different client.");

        prescription.MoveToAwaitingConfirmation();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
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

        var clients = await LoadClientsByIdsAsync(
          prescriptions.Select(x => x.ClientId).Distinct().ToList(),
          cancellationToken);

        return prescriptions.Select(p => MapToResponse(p, clients.GetValueOrDefault(p.ClientId))).ToList();
    }

    public async Task<IReadOnlyList<PrescriptionResponse>> GetAwaitingConfirmationAsync(
      CancellationToken cancellationToken = default)
    {
        var prescriptions = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.Status == PrescriptionStatus.AwaitingConfirmation)
          .OrderBy(x => x.CreatedAtUtc)
          .Include(x => x.Images)
          .ToListAsync(cancellationToken);

        var clients = await LoadClientsByIdsAsync(
          prescriptions.Select(x => x.ClientId).Distinct().ToList(),
          cancellationToken);

        return prescriptions.Select(p => MapToResponse(p, clients.GetValueOrDefault(p.ClientId))).ToList();
    }

    public async Task<PrescriptionResponse> ConfirmPaymentAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        prescription.MoveToQueue();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
    }

    public async Task<IReadOnlyList<PrescriptionResponse>> GetPharmacistQueueAsync(
      CancellationToken cancellationToken = default)
    {
        var prescriptions = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.Status == PrescriptionStatus.InQueue)
          .OrderBy(x => x.CreatedAtUtc)
          .Include(x => x.Images)
          .ToListAsync(cancellationToken);

        var clients = await LoadClientsByIdsAsync(
          prescriptions.Select(x => x.ClientId).Distinct().ToList(),
          cancellationToken);

        return prescriptions.Select(p => MapToResponse(p, clients.GetValueOrDefault(p.ClientId))).ToList();
    }

    /// <summary>
    /// Pharmacist's full visible workspace: every InQueue request (anyone
    /// can grab) plus their own InReview / Decoded ones. Powers the
    /// "switch active prescription" picker and the status-tabs view.
    /// </summary>
    public async Task<IReadOnlyList<PrescriptionResponse>> GetPharmacistAllAsync(
      Guid pharmacistId,
      CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new InvalidOperationException("PharmacistId can't be empty.");

        var prescriptions = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x =>
            x.Status == PrescriptionStatus.InQueue
            || ((x.Status == PrescriptionStatus.InReview || x.Status == PrescriptionStatus.Decoded)
                && x.AssignedPharmacistId == pharmacistId))
          .OrderByDescending(x => x.CreatedAtUtc)
          .Include(x => x.Images)
          .Include(x => x.Items)
          .ToListAsync(cancellationToken);

        var clients = await LoadClientsByIdsAsync(
          prescriptions.Select(x => x.ClientId).Distinct().ToList(),
          cancellationToken);

        return prescriptions.Select(p => MapToResponse(p, clients.GetValueOrDefault(p.ClientId))).ToList();
    }

    public async Task<PrescriptionResponse> GetForPharmacistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new InvalidOperationException("PharmacistId can't be empty.");
        if (prescriptionId == Guid.Empty)
            throw new InvalidOperationException("PrescriptionId can't be empty.");

        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.Id == prescriptionId)
          .Include(x => x.Images)
          .Include(x => x.Items)
          .FirstOrDefaultAsync(cancellationToken)
          ?? throw new InvalidOperationException("Prescription not found.");

        // Pharmacists can read anything in the open queue; once a
        // prescription is taken into review only the assignee can keep
        // working on it. Decoded prescriptions stay readable so the
        // pharmacist can review their past work.
        var allowed = prescription.Status switch
        {
            PrescriptionStatus.InQueue => true,
            PrescriptionStatus.InReview => prescription.AssignedPharmacistId == pharmacistId,
            PrescriptionStatus.Decoded => prescription.AssignedPharmacistId == pharmacistId,
            _ => false
        };

        if (!allowed)
            throw new UnauthorizedAccessException("Prescription is not available for this pharmacist.");

        var client = await _dbContext.Users
          .AsNoTracking()
          .FirstOrDefaultAsync(u => u.Id == prescription.ClientId, cancellationToken);

        return MapToResponse(prescription, client);
    }

    public async Task<PrescriptionResponse> TakeIntoReviewAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        prescription.TakeIntoReview(pharmacistId);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
    }

    public async Task<PrescriptionResponse> SubmitChecklistAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      DecodePrescriptionRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (pharmacistId == Guid.Empty)
            throw new InvalidOperationException("PharmacistId can't be empty.");

        if (request.Items is null || request.Items.Count == 0)
            throw new InvalidOperationException("Чек-лист должен содержать хотя бы одну позицию.");

        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        if (prescription.AssignedPharmacistId != pharmacistId)
            throw new UnauthorizedAccessException("Only the assigned pharmacist can submit this checklist.");

        // Only allow MedicineIds that actually exist + are active, so we
        // don't end up with checklists pointing to nothing later.
        var refIds = request.Items
          .Where(i => i.MedicineId.HasValue)
          .Select(i => i.MedicineId!.Value)
          .Distinct()
          .ToList();

        if (refIds.Count > 0)
        {
            var foundIds = await _dbContext.Medicines
              .AsNoTracking()
              .Where(m => refIds.Contains(m.Id))
              .Select(m => m.Id)
              .ToListAsync(cancellationToken);

            var missing = refIds.Except(foundIds).ToList();
            if (missing.Count > 0)
                throw new InvalidOperationException(
                  $"Medicine(s) not found in catalog: {string.Join(", ", missing)}");
        }

        var items = new List<PrescriptionChecklistItem>(request.Items.Count);
        foreach (var i in request.Items)
        {
            items.Add(i.MedicineId.HasValue
              ? PrescriptionChecklistItem.FromCatalog(
                  i.MedicineId.Value,
                  i.Quantity,
                  i.PharmacistComment)
              : PrescriptionChecklistItem.Manual(
                  i.ManualMedicineName ?? string.Empty,
                  i.Quantity,
                  i.PharmacistComment));
        }

        prescription.SubmitChecklist(request.OverallComment, items);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
    }

    private async Task<Prescription> LoadTrackedAsync(
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        if (prescriptionId == Guid.Empty)
            throw new InvalidOperationException("PrescriptionId can't be empty.");

        return await _dbContext.Prescriptions
          .Where(x => x.Id == prescriptionId)
          .Include(x => x.Items)
          .Include(x => x.Images)
          .FirstOrDefaultAsync(cancellationToken)
          ?? throw new InvalidOperationException("Prescription not found.");
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

        if (prescription is null) return null;

        var client = await _dbContext.Users
          .AsNoTracking()
          .FirstOrDefaultAsync(u => u.Id == prescription.ClientId, cancellationToken);

        return MapToResponse(prescription, client);
    }

    private static PrescriptionResponse MapToResponse(Prescription prescription, User? client = null)
    {
        return new PrescriptionResponse
        {
            PrescriptionId = prescription.Id,
            ClientId = prescription.ClientId,
            ClientName = client?.Name,
            ClientPhoneNumber = client?.PhoneNumber,
            ClientTelegramId = client?.TelegramId,
            ClientTelegramUsername = client?.TelegramUsername,
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

    private async Task<Dictionary<Guid, User>> LoadClientsByIdsAsync(
      IReadOnlyCollection<Guid> clientIds,
      CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0) return new();
        return await _dbContext.Users
          .AsNoTracking()
          .Where(u => clientIds.Contains(u.Id))
          .ToDictionaryAsync(u => u.Id, cancellationToken);
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

    /// <summary>
    /// Builds a DushanbeCity payment URL for the 3 TJS service fee. Mirrors
    /// the URL-builder StubPaymentService uses for orders, but with a
    /// prescription-id comment so the bank receipt can be matched back to
    /// the right request. Returns an empty string if no DC base URL is
    /// configured (e.g. dev without seed) — caller falls back to manual
    /// confirmation flow.
    /// </summary>
    private async Task<string> BuildPaymentUrlAsync(
      string clientPhone,
      Guid prescriptionId,
      CancellationToken cancellationToken)
    {
        var overrideUrl = await _paymentSettingsService.GetDcBaseUrlAsync(cancellationToken);
        var baseUrl = !string.IsNullOrWhiteSpace(overrideUrl) ? overrideUrl : _paymentOptions.BaseUrl;
        if (string.IsNullOrWhiteSpace(baseUrl))
            return string.Empty;

        var amount = DecodingFeeAmount.ToString("0.00", CultureInfo.InvariantCulture);
        var phone = NormalizePhoneForPaymentComment(clientPhone);
        var comment = $"ClientNumber: {phone} & PrescriptionId: {prescriptionId}";
        var url = WithQueryParameter(baseUrl, "s", amount);
        url = WithQueryParameter(url, "c", comment);
        return url;
    }

    private static string NormalizePhoneForPaymentComment(string? phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber)) return "unknown";
        var digits = new string(phoneNumber.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("992", StringComparison.Ordinal) && digits.Length == 12)
            return digits[3..];
        return digits.Length > 0 ? digits : phoneNumber.Trim();
    }

    private static string WithQueryParameter(string url, string key, string value)
    {
        var source = url ?? string.Empty;
        var fragmentIndex = source.IndexOf('#');
        var fragment = fragmentIndex >= 0 ? source[fragmentIndex..] : string.Empty;
        var withoutFragment = fragmentIndex >= 0 ? source[..fragmentIndex] : source;
        var queryIndex = withoutFragment.IndexOf('?');
        var path = queryIndex >= 0 ? withoutFragment[..queryIndex] : withoutFragment;
        var query = queryIndex >= 0 ? withoutFragment[(queryIndex + 1)..] : string.Empty;

        var parameters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(query))
        {
            foreach (var segment in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var eqIdx = segment.IndexOf('=');
                if (eqIdx < 0)
                {
                    var k = Uri.UnescapeDataString(segment);
                    if (!string.IsNullOrWhiteSpace(k)) parameters[k] = string.Empty;
                    continue;
                }
                var pk = Uri.UnescapeDataString(segment[..eqIdx]);
                if (string.IsNullOrWhiteSpace(pk)) continue;
                parameters[pk] = Uri.UnescapeDataString(segment[(eqIdx + 1)..]);
            }
        }
        parameters[key] = value;

        var rebuilt = string.Join(
          "&",
          parameters.Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

        return rebuilt.Length == 0 ? $"{path}{fragment}" : $"{path}?{rebuilt}{fragment}";
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
