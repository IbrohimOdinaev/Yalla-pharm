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
    private readonly IRealtimeUpdatesPublisher _realtimePublisher;
    private readonly IManualItemLookupService? _manualLookupService;
    private readonly IAuditLogger? _auditLogger;
    private readonly IPrivacyPolicyService? _privacyPolicyService;

    public PrescriptionService(
      IAppDbContext dbContext,
      IPrescriptionImageStorage imageStorage,
      IPaymentSettingsService paymentSettingsService,
      IOptions<DushanbeCityPaymentOptions> paymentOptions,
      IRealtimeUpdatesPublisher realtimePublisher)
      : this(dbContext, imageStorage, paymentSettingsService, paymentOptions, realtimePublisher, manualLookupService: null, auditLogger: null, privacyPolicyService: null)
    {
    }

    public PrescriptionService(
      IAppDbContext dbContext,
      IPrescriptionImageStorage imageStorage,
      IPaymentSettingsService paymentSettingsService,
      IOptions<DushanbeCityPaymentOptions> paymentOptions,
      IRealtimeUpdatesPublisher realtimePublisher,
      IManualItemLookupService? manualLookupService,
      IAuditLogger? auditLogger = null,
      IPrivacyPolicyService? privacyPolicyService = null)
    {
        _dbContext = dbContext;
        _imageStorage = imageStorage;
        _paymentSettingsService = paymentSettingsService;
        _paymentOptions = paymentOptions.Value;
        _realtimePublisher = realtimePublisher;
        _manualLookupService = manualLookupService;
        _auditLogger = auditLogger;
        _privacyPolicyService = privacyPolicyService;
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

        // Privacy-policy gate — uploading a prescription photo is
        // processing of "special category" personal data (медицинские
        // данные) under Закон РТ № 1537. The acceptance check must run
        // BEFORE any image is read off the wire or uploaded to MinIO
        // so we don't store anything until consent is on record.
        if (_privacyPolicyService is not null)
        {
            var accepted = await _privacyPolicyService.HasAcceptedCurrentAsync(clientId, cancellationToken);
            if (!accepted)
            {
                throw new ClientErrorException(
                  errorCode: "privacy_policy_acceptance_required",
                  detail: "Перед загрузкой рецепта необходимо принять обновлённую политику обработки персональных данных.",
                  reason: "privacy_policy_acceptance_required",
                  statusCode: 412);
            }
        }

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

            // Map raw int → enum, defaulting to AsPrescribed for any value
            // outside the known range (defensive against API misuse).
            var tier = Enum.IsDefined(typeof(PrescriptionPreferenceTier), request.PreferenceTier)
              ? (PrescriptionPreferenceTier)request.PreferenceTier
              : PrescriptionPreferenceTier.AsPrescribed;

            var prescription = new Prescription(
              clientId,
              request.PatientAge,
              request.ClientComment,
              prescriptionImages,
              tier);

            // Stay in Submitted until the client confirms they paid the
            // 3 TJS DC fee. After payment they hit POST /i-paid which
            // moves the prescription to AwaitingConfirmation; SuperAdmin
            // then verifies the bank receipt and pushes it to InQueue.
            _dbContext.Prescriptions.Add(prescription);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _realtimePublisher.PublishPrescriptionUpdatedAsync(
              prescription.Id, prescription.ClientId, prescription.Status,
              prescription.AssignedPharmacistId, cancellationToken);

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

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          prescription.Id, prescription.ClientId, prescription.Status,
          prescription.AssignedPharmacistId, cancellationToken);

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

        var tempOfferStats = await LoadTempOfferStatsAsync(prescriptions, cancellationToken);
        var medicineTitles = await LoadMedicineTitlesAsync(prescriptions, cancellationToken);

        var responses = new List<PrescriptionResponse>(prescriptions.Count);
        foreach (var p in prescriptions)
        {
            var client = clients.GetValueOrDefault(p.ClientId);
            var resp = MapToResponse(p, client, tempOfferStats, medicineTitles);

            // Re-issue a fresh DC payment URL while the prescription is still
            // Submitted (waiting for the user to pay). The detail page renders
            // it as a clickable "Оплатить 3 TJS" link; once the manual-payment
            // confirm or the 24h timeout job advances the status, the URL is
            // no longer attached.
            if (p.Status == PrescriptionStatus.Submitted && client is not null)
            {
                try
                {
                    resp.PaymentUrl = await BuildPaymentUrlAsync(
                      client.PhoneNumber ?? string.Empty,
                      p.Id,
                      cancellationToken);
                    resp.PaymentAmount = DecodingFeeAmount;
                    resp.PaymentCurrency = DecodingFeeCurrency;
                }
                catch
                {
                    // Settings outage shouldn't break the list — surface a null
                    // URL and let the client retry on next load.
                }
            }
            responses.Add(resp);
        }
        return responses;
    }

    public async Task<IReadOnlyList<PrescriptionResponse>> GetAwaitingConfirmationAsync(
      CancellationToken cancellationToken = default)
    {
        // Includes BOTH Submitted (uploaded but not yet paid — SuperAdmin can
        // see the request and confirm once the bank receipt lands) AND the
        // legacy AwaitingConfirmation status (older flow where the client
        // self-clicked "Я оплатил"). The frontend renders both with the same
        // "Подтвердить оплату" CTA — confirmPaymentAsync below handles either.
        var prescriptions = await _dbContext.Prescriptions
          .AsNoTracking()
          .Where(x => x.Status == PrescriptionStatus.Submitted
                   || x.Status == PrescriptionStatus.AwaitingConfirmation)
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

        // SuperAdmin's confirm now bridges Submitted directly to InQueue. The
        // domain still enforces the two-step transition, so we walk
        // Submitted → AwaitingConfirmation → InQueue here. Already-pending
        // ones (legacy "Я оплатил" flow) just take the second step.
        if (prescription.Status == PrescriptionStatus.Submitted)
            prescription.MoveToAwaitingConfirmation();
        prescription.MoveToQueue();

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          prescription.Id, prescription.ClientId, prescription.Status,
          prescription.AssignedPharmacistId, cancellationToken);

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

        var medicineTitles = await LoadMedicineTitlesAsync(prescriptions, cancellationToken);
        var tempOfferStats = await LoadTempOfferStatsAsync(prescriptions, cancellationToken);

        return prescriptions
          .Select(p => MapToResponse(p, clients.GetValueOrDefault(p.ClientId), tempOfferStats, medicineTitles))
          .ToList();
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

        var medicineTitles = await LoadMedicineTitlesAsync(new[] { prescription }, cancellationToken);
        var tempOfferStats = await LoadTempOfferStatsAsync(new[] { prescription }, cancellationToken);

        return MapToResponse(prescription, client, tempOfferStats, medicineTitles);
    }

    public async Task<PrescriptionResponse> TakeIntoReviewAsync(
      Guid pharmacistId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        prescription.TakeIntoReview(pharmacistId);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          prescription.Id, prescription.ClientId, prescription.Status,
          prescription.AssignedPharmacistId, cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
    }

    public async Task<MoveChecklistToCartResponse> MoveChecklistToCartAsync(
      Guid clientId,
      Guid prescriptionId,
      IReadOnlyDictionary<Guid, int>? quantityOverrides,
      IReadOnlyDictionary<Guid, Guid>? pairSelections,
      CancellationToken cancellationToken = default)
    {
        if (clientId == Guid.Empty)
            throw new InvalidOperationException("ClientId can't be empty.");

        var prescription = await LoadTrackedAsync(prescriptionId, cancellationToken);
        if (prescription.ClientId != clientId)
            throw new UnauthorizedAccessException("Prescription belongs to a different client.");

        if (prescription.Status != PrescriptionStatus.Decoded)
            throw new InvalidOperationException(
              $"Prescription must be in Decoded status to move to cart; current is {prescription.Status}.");

        // Build the "logical order line" plan up front so the basket mutation
        // loop below has a single source of truth. The plan walks pairs and
        // standalone items uniformly:
        //   • paired items contribute exactly one row to the order — the side
        //     the client picked (or analog by default), falling back to the
        //     other side if the chosen one is ineligible.
        //   • standalone items contribute themselves directly.
        // The analog itself is filtered out from the standalone iteration so
        // it doesn't show up twice.
        var itemsById = prescription.Items.ToDictionary(i => i.Id);
        var analogIds = new HashSet<Guid>(prescription.Items
          .Where(i => i.AnalogItemId.HasValue)
          .Select(i => i.AnalogItemId!.Value));

        // Pre-load medicines for everything that could end up in the order —
        // both originals AND analogs — so the eligibility check below has the
        // catalog row available without a per-item round-trip.
        var medicineIds = prescription.Items
          .Where(i => i.MedicineId.HasValue)
          .Select(i => i.MedicineId!.Value)
          .Distinct()
          .ToList();

        var activeMedicines = medicineIds.Count == 0
          ? new Dictionary<Guid, Medicine>()
          : await _dbContext.Medicines
              .AsTracking()
              .Where(m => medicineIds.Contains(m.Id) && m.IsActive)
              .ToDictionaryAsync(m => m.Id, cancellationToken);

        var existingPositions = await _dbContext.BasketPositions
          .AsTracking()
          .Where(b => b.ClientId == clientId
                   && medicineIds.Contains(b.MedicineId))
          .ToDictionaryAsync(b => b.MedicineId, cancellationToken);

        // Override semantics:
        //   • key absent  → pharmacist-recommended count
        //   • value  > 0  → client's chosen quantity
        //   • value == 0  → client removed this item; the side is ineligible
        int? EffectiveQty(Domain.Entities.PrescriptionChecklistItem item)
        {
            var qty = item.Quantity;
            if (quantityOverrides is not null
              && quantityOverrides.TryGetValue(item.Id, out var overrideQty))
            {
                if (overrideQty <= 0) return null;
                qty = overrideQty;
            }
            return qty > 0 ? qty : null;
        }

        // A side is "orderable" iff it's a catalog row pointing at an active
        // medicine and the effective quantity is positive. Manual rows and
        // undecoded rows are never orderable on the cart side.
        bool IsEligible(Domain.Entities.PrescriptionChecklistItem item, out Medicine? medicine, out int qty)
        {
            medicine = null;
            qty = 0;
            if (!item.MedicineId.HasValue) return false;
            if (!activeMedicines.TryGetValue(item.MedicineId.Value, out medicine)) return false;
            var effective = EffectiveQty(item);
            if (effective is null) return false;
            qty = effective.Value;
            return true;
        }

        var moved = 0;
        var skipped = 0;

        foreach (var item in prescription.Items)
        {
            // Skip items that are referenced as analogs by other rows — they
            // contribute through their pair-original, not on their own.
            if (analogIds.Contains(item.Id)) continue;

            Domain.Entities.PrescriptionChecklistItem? chosen = null;
            Medicine? chosenMedicine = null;
            int chosenQty = 0;

            if (item.AnalogItemId.HasValue
              && itemsById.TryGetValue(item.AnalogItemId.Value, out var analog))
            {
                // Default selection = the analog (cheaper substitute). The
                // client can override per pair via PairSelections; the value
                // must point to either the original (item.Id) or the analog
                // itself. Anything else falls back to the default.
                var preferAnalogFirst = true;
                if (pairSelections is not null
                  && pairSelections.TryGetValue(item.Id, out var picked))
                {
                    if (picked == item.Id) preferAnalogFirst = false;
                    else if (picked == analog.Id) preferAnalogFirst = true;
                    // Unknown id → ignore, fall through to default.
                }

                if (preferAnalogFirst)
                {
                    if (IsEligible(analog, out var medA, out var qtyA))
                    { chosen = analog; chosenMedicine = medA; chosenQty = qtyA; }
                    else if (IsEligible(item, out var medO, out var qtyO))
                    { chosen = item; chosenMedicine = medO; chosenQty = qtyO; }
                }
                else
                {
                    if (IsEligible(item, out var medO, out var qtyO))
                    { chosen = item; chosenMedicine = medO; chosenQty = qtyO; }
                    else if (IsEligible(analog, out var medA, out var qtyA))
                    { chosen = analog; chosenMedicine = medA; chosenQty = qtyA; }
                }
            }
            else
            {
                if (IsEligible(item, out var med, out var qty))
                { chosen = item; chosenMedicine = med; chosenQty = qty; }
            }

            if (chosen is null || chosenMedicine is null)
            {
                skipped++;
                continue;
            }

            if (existingPositions.TryGetValue(chosenMedicine.Id, out var existing))
            {
                existing.SetQuantity(existing.Quantity + chosenQty);
            }
            else
            {
                var newPosition = new BasketPosition(clientId, chosenMedicine.Id, chosenMedicine, chosenQty);
                _dbContext.BasketPositions.Add(newPosition);
                existingPositions[chosenMedicine.Id] = newPosition;
            }
            moved++;
        }

        prescription.MarkMovedToCart();
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          prescription.Id, prescription.ClientId, prescription.Status,
          prescription.AssignedPharmacistId, cancellationToken);

        var prescriptionResponse = await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");

        return new MoveChecklistToCartResponse
        {
            Prescription = prescriptionResponse,
            MovedItemsCount = moved,
            SkippedItemsCount = skipped,
        };
    }

    public async Task<PrescriptionResponse> ResubmitPrescriptionAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (clientId == Guid.Empty)
            throw new InvalidOperationException("ClientId can't be empty.");

        var original = await LoadTrackedAsync(prescriptionId, cancellationToken);
        if (original.ClientId != clientId)
            throw new UnauthorizedAccessException("Prescription belongs to a different client.");

        if (original.Status != PrescriptionStatus.Cancelled)
            throw new InvalidOperationException(
              $"Only a cancelled prescription can be resubmitted; current status is {original.Status}.");

        if (original.Images.Count == 0)
            throw new InvalidOperationException("Prescription has no images to resubmit.");

        // Reuse the original MinIO object keys instead of re-uploading bytes —
        // the storage objects are immutable and shared across prescriptions
        // is safe (each PrescriptionImage row has its own id, the URL endpoint
        // resolves id → key → bytes). The original prescription stays as
        // Cancelled in history, the new one starts fresh in Submitted.
        var clonedImages = original.Images
          .OrderBy(i => i.OrderIndex)
          .Select(i => new PrescriptionImage(i.Key, i.OrderIndex))
          .ToList();

        var resubmitted = new Prescription(
          clientId,
          original.PatientAge,
          original.ClientComment,
          clonedImages,
          original.PreferenceTier);

        _dbContext.Prescriptions.Add(resubmitted);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          resubmitted.Id, resubmitted.ClientId, resubmitted.Status,
          resubmitted.AssignedPharmacistId, cancellationToken);

        var clientPhone = await _dbContext.Clients
          .AsNoTracking()
          .Where(c => c.Id == clientId)
          .Select(c => c.PhoneNumber)
          .FirstOrDefaultAsync(cancellationToken)
          ?? string.Empty;

        var paymentUrl = await BuildPaymentUrlAsync(
          clientPhone,
          resubmitted.Id,
          cancellationToken);

        var response = await BuildResponseAsync(resubmitted.Id, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load resubmitted prescription.");

        response.PaymentUrl = paymentUrl;
        response.PaymentAmount = DecodingFeeAmount;
        response.PaymentCurrency = DecodingFeeCurrency;
        return response;
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
        // don't end up with checklists pointing to nothing later. Analog
        // pairing now points to sibling items by index — validated below.
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

        // First pass — materialise items in input order so AnalogIndex
        // (positional reference into request.Items) maps cleanly to a
        // freshly-generated item id below.
        var items = new List<PrescriptionChecklistItem>(request.Items.Count);
        foreach (var i in request.Items)
        {
            // Map raw int → enum, defaulting to Original for any value
            // outside the known range.
            var kind = Enum.IsDefined(typeof(PrescriptionChecklistItemKind), i.Kind)
              ? (PrescriptionChecklistItemKind)i.Kind
              : PrescriptionChecklistItemKind.Original;

            if (kind == PrescriptionChecklistItemKind.Undecoded)
            {
                items.Add(PrescriptionChecklistItem.Undecoded(i.Quantity, i.PharmacistComment));
                continue;
            }

            // AnalogMedicineId is the legacy v1 field — kept for the entity
            // factory signature but always passed as null by the new flow.
            var item = i.MedicineId.HasValue
              ? PrescriptionChecklistItem.FromCatalog(
                  i.MedicineId.Value,
                  i.Quantity,
                  i.PharmacistComment,
                  analogMedicineId: null)
              : PrescriptionChecklistItem.Manual(
                  i.ManualMedicineName ?? string.Empty,
                  i.Quantity,
                  i.PharmacistComment);

            // Carry the lookup-request binding through to the persisted
            // item so the unique partial index keeps reflecting the
            // pharmacist's outstanding asks. The lookup itself stays
            // Open until the close pass below.
            if (i.LookupRequestId.HasValue && !i.MedicineId.HasValue)
                item.AttachLookupRequest(i.LookupRequestId.Value);

            // Unit-mode override — pharmacist's manual price/qty per
            // tablet/ampoule/etc. Quantity already reflects the
            // package count; UnitCount + UnitTotalPrice ride along
            // and replace the line total at order-creation time.
            if (i.UseUnitMode && i.UnitCount.HasValue && i.UnitTotalPrice.HasValue)
                item.SetUnitOverride(i.UnitCount.Value, i.UnitTotalPrice.Value);

            items.Add(item);
        }

        // Second pass — link pairs. AnalogIndex must be inside the bounds
        // of the items list, must not point to itself, and the referenced
        // sibling can't itself reference back (no cycles). Undecoded rows
        // can't carry a pair on either side; the entity-level setter
        // re-checks that — duplicating here keeps the error message
        // close to the request payload for clearer client-side debugging.
        for (var idx = 0; idx < request.Items.Count; idx++)
        {
            var input = request.Items[idx];
            if (!input.AnalogIndex.HasValue) continue;

            var pairIdx = input.AnalogIndex.Value;
            if (pairIdx < 0 || pairIdx >= items.Count)
                throw new InvalidOperationException(
                  $"AnalogIndex {pairIdx} on item #{idx} is out of bounds (items count: {items.Count}).");

            if (pairIdx == idx)
                throw new InvalidOperationException(
                  $"Item #{idx} cannot reference itself as its analog.");

            var partner = request.Items[pairIdx];
            if (partner.AnalogIndex.HasValue)
                throw new InvalidOperationException(
                  $"Item #{idx} references item #{pairIdx} which is itself an original of another pair (cycles aren't allowed).");

            items[idx].SetAnalogItem(items[pairIdx].Id);
        }

        prescription.SubmitChecklist(request.OverallComment, items);

        if (_auditLogger is not null)
        {
            await _auditLogger.LogAsync(
              AuditAction.PrescriptionDecoded,
              entityType: "Prescription",
              entityId: prescription.Id,
              summary: $"Pharmacist submitted checklist with {items.Count} item(s).",
              payload: new
              {
                  pharmacistId = prescription.AssignedPharmacistId,
                  itemsCount = items.Count,
                  catalogItemsCount = items.Count(i => i.MedicineId.HasValue),
                  manualItemsCount = items.Count(i => !i.MedicineId.HasValue),
                  hasOverallComment = !string.IsNullOrWhiteSpace(request.OverallComment),
              },
              cancellationToken: cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Auto-close every Open lookup request for this prescription —
        // submitting the checklist is the contractual signal that the
        // pharmacist is done collecting answers. Each closed request fan-
        // outs to admins via SignalR so their "active" tab clears.
        if (_manualLookupService is not null)
        {
            await _manualLookupService.CloseRequestsForPrescriptionAsync(
              prescription.Id, cancellationToken);
        }

        await _realtimePublisher.PublishPrescriptionUpdatedAsync(
          prescription.Id, prescription.ClientId, prescription.Status,
          prescription.AssignedPharmacistId, cancellationToken);

        return await BuildResponseAsync(prescriptionId, cancellationToken)
          ?? throw new InvalidOperationException("Failed to load updated prescription.");
    }

    public async Task<GetPrescriptionPharmacyOptionsResponse> GetPharmacyOptionsAsync(
      Guid clientId,
      Guid prescriptionId,
      CancellationToken cancellationToken = default)
    {
        if (clientId == Guid.Empty)
            throw new InvalidOperationException("ClientId can't be empty.");
        if (prescriptionId == Guid.Empty)
            throw new InvalidOperationException("PrescriptionId can't be empty.");

        var prescription = await _dbContext.Prescriptions
          .AsNoTracking()
          .Include(p => p.Items)
          .FirstOrDefaultAsync(p => p.Id == prescriptionId && p.ClientId == clientId, cancellationToken)
          ?? throw new InvalidOperationException(
              $"Prescription '{prescriptionId}' for client '{clientId}' was not found.");

        // Pharmacy options only make sense once the pharmacist has finished
        // composing the checklist — pre-Decoded prescriptions don't yet
        // know what to order, post-Cancelled ones are dead.
        if (prescription.Status is not (PrescriptionStatus.Decoded
                                     or PrescriptionStatus.OrderPlaced
                                     or PrescriptionStatus.MovedToCart))
        {
            return new GetPrescriptionPharmacyOptionsResponse
            {
                PrescriptionId = prescription.Id,
                PharmacyOptions = []
            };
        }

        var orderableItems = prescription.Items
          .Where(i => i.MedicineId.HasValue || i.LookupRequestId.HasValue)
          .ToList();

        if (orderableItems.Count == 0)
        {
            return new GetPrescriptionPharmacyOptionsResponse
            {
                PrescriptionId = prescription.Id,
                PharmacyOptions = []
            };
        }

        // Catalog items contribute their MedicineId directly; manual items
        // contribute every shadow medicine materialised from their lookup
        // (one per responding pharmacy). The flat (medicineId, item, isShadow)
        // tuples below let the pharmacy sweep look up offers uniformly.
        var lookupRequestIds = orderableItems
          .Where(i => i.LookupRequestId.HasValue)
          .Select(i => i.LookupRequestId!.Value)
          .ToList();

        var shadowRows = lookupRequestIds.Count == 0
          ? new List<ShadowMedicineRow>()
          : await _dbContext.Medicines
              .AsNoTracking()
              .Where(m => m.ManualLookupRequestId.HasValue
                       && lookupRequestIds.Contains(m.ManualLookupRequestId.Value))
              .Select(m => new ShadowMedicineRow(
                  m.Id,
                  m.ManualLookupRequestId!.Value,
                  m.Title))
              .ToListAsync(cancellationToken);

        var shadowsByLookup = shadowRows
          .GroupBy(s => s.LookupRequestId)
          .ToDictionary(g => g.Key, g => g.ToList());

        var catalogMedicineIds = orderableItems
          .Where(i => i.MedicineId.HasValue)
          .Select(i => i.MedicineId!.Value)
          .Distinct()
          .ToList();

        // Load catalog rows once and split: titles for display + the
        // subset that's still IsActive. Inactive catalog medicines are
        // kept on the prescription (the pharmacist already decoded them)
        // but excluded from the pharmacy-options offer pool — otherwise
        // the picker shows them as "isFound" and checkout later rejects
        // the whole order with "Medicine inactive and cannot be checked
        // out". With this filter, the row simply renders as
        // "не доступно" at every pharmacy and the user can pick the
        // remaining items.
        var catalogRows = catalogMedicineIds.Count == 0
          ? new List<(Guid Id, string Title, bool IsActive)>()
          : await _dbContext.Medicines
              .AsNoTracking()
              .Where(m => catalogMedicineIds.Contains(m.Id))
              .Select(m => new { m.Id, m.Title, m.IsActive })
              .ToListAsync(cancellationToken)
              .ContinueWith(t => t.Result.Select(r => (r.Id, r.Title, r.IsActive)).ToList(), cancellationToken);

        var catalogTitles = catalogRows.ToDictionary(r => r.Id, r => r.Title);
        var activeCatalogIds = catalogRows
          .Where(r => r.IsActive)
          .Select(r => r.Id)
          .ToHashSet();

        // Shadow medicines materialised for manual lookups always carry
        // IsActive = true on creation, so we don't need to recheck them.
        var activeMedicineIds = activeCatalogIds
          .Concat(shadowRows.Select(s => s.MedicineId))
          .Distinct()
          .ToList();

        var pharmacies = await _dbContext.Pharmacies
          .AsNoTracking()
          .Select(p => new { p.Id, p.Title, p.IsActive })
          .ToListAsync(cancellationToken);

        var offers = await _dbContext.Offers
          .AsNoTracking()
          .Where(o => activeMedicineIds.Contains(o.MedicineId))
          .Select(o => new { o.PharmacyId, o.MedicineId, o.Price, o.StockQuantity })
          .ToListAsync(cancellationToken);

        var offerLookup = offers
          .ToDictionary(o => (o.PharmacyId, o.MedicineId), o => o);

        var totalItemsCount = orderableItems.Count;
        var options = new List<PrescriptionPharmacyOptionResponse>(pharmacies.Count);

        foreach (var pharmacy in pharmacies)
        {
            var foundCount = 0;
            var enoughCount = 0;
            decimal totalCost = 0m;
            var lineItems = new List<PrescriptionPharmacyItemResponse>(totalItemsCount);

            foreach (var item in orderableItems)
            {
                Guid? resolvedMedicineId;
                string title;
                bool isManual;

                if (item.MedicineId.HasValue)
                {
                    resolvedMedicineId = item.MedicineId.Value;
                    title = catalogTitles.TryGetValue(item.MedicineId.Value, out var t)
                      ? t
                      : "—";
                    isManual = false;
                }
                else
                {
                    isManual = true;
                    if (shadowsByLookup.TryGetValue(item.LookupRequestId!.Value, out var shadows))
                    {
                        // Pick the shadow medicine for this pharmacy if it
                        // exists. Each pharmacy answers at most once per
                        // lookup, so this is deterministic.
                        var shadowForPharmacy = shadows.FirstOrDefault(s =>
                          offerLookup.ContainsKey((pharmacy.Id, s.MedicineId)));
                        resolvedMedicineId = shadowForPharmacy?.MedicineId;
                        title = shadowForPharmacy?.Title
                          ?? item.ManualMedicineName
                          ?? "—";
                    }
                    else
                    {
                        resolvedMedicineId = null;
                        title = item.ManualMedicineName ?? "—";
                    }
                }

                if (resolvedMedicineId.HasValue
                  && offerLookup.TryGetValue((pharmacy.Id, resolvedMedicineId.Value), out var offer))
                {
                    var hasEnough = offer.StockQuantity >= item.Quantity;
                    foundCount++;
                    if (hasEnough) enoughCount++;
                    // Unit-mode rows contribute the pharmacist-specified
                    // total directly, ignoring the offer price entirely.
                    // Catalog rows keep the live offer × min(qty, stock)
                    // formula so partial coverage shows a fair partial.
                    if (item.UseUnitMode && item.UnitTotalPrice.HasValue)
                        totalCost += item.UnitTotalPrice.Value;
                    else
                        totalCost += offer.Price * Math.Min(item.Quantity, offer.StockQuantity);

                    lineItems.Add(new PrescriptionPharmacyItemResponse
                    {
                        ChecklistItemId = item.Id,
                        MedicineId = resolvedMedicineId,
                        RequestedQuantity = item.Quantity,
                        Title = title,
                        IsFound = true,
                        FoundQuantity = offer.StockQuantity,
                        HasEnoughQuantity = hasEnough,
                        Price = offer.Price,
                        IsManualLookup = isManual,
                        UseUnitMode = item.UseUnitMode,
                        UnitCount = item.UnitCount,
                        UnitTotalPrice = item.UnitTotalPrice
                    });
                }
                else
                {
                    lineItems.Add(new PrescriptionPharmacyItemResponse
                    {
                        ChecklistItemId = item.Id,
                        MedicineId = null,
                        RequestedQuantity = item.Quantity,
                        Title = title,
                        IsFound = false,
                        FoundQuantity = 0,
                        HasEnoughQuantity = false,
                        Price = null,
                        IsManualLookup = isManual
                    });
                }
            }

            options.Add(new PrescriptionPharmacyOptionResponse
            {
                PharmacyId = pharmacy.Id,
                PharmacyTitle = pharmacy.Title,
                PharmacyIsActive = pharmacy.IsActive,
                FoundItemsCount = foundCount,
                TotalItemsCount = totalItemsCount,
                EnoughQuantityItemsCount = enoughCount,
                IsAvailable = pharmacy.IsActive && enoughCount == totalItemsCount,
                TotalCost = totalCost,
                Items = lineItems
            });
        }

        return new GetPrescriptionPharmacyOptionsResponse
        {
            PrescriptionId = prescription.Id,
            PharmacyOptions = options
              .OrderByDescending(x => x.FoundItemsCount)
              .ThenByDescending(x => x.EnoughQuantityItemsCount)
              .ThenBy(x => x.TotalCost)
              .ThenBy(x => x.PharmacyTitle)
              .ToList()
        };
    }

    private sealed record ShadowMedicineRow(Guid MedicineId, Guid LookupRequestId, string Title);

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

        var tempOfferStats = await LoadTempOfferStatsAsync(
          new[] { prescription }, cancellationToken);
        var medicineTitles = await LoadMedicineTitlesAsync(new[] { prescription }, cancellationToken);
        var response = MapToResponse(prescription, client, tempOfferStats, medicineTitles);

        // Re-issue a fresh DC payment URL on every read while the prescription
        // is still waiting for payment. The frontend shows it as a clickable
        // "Оплатить" link instead of the old "Я оплатил" button — once the
        // 24h payment-timeout job fires, the prescription flips to Cancelled
        // and we stop attaching the URL (no point paying for a dead request).
        if (prescription.Status == PrescriptionStatus.Submitted && client is not null)
        {
            try
            {
                response.PaymentUrl = await BuildPaymentUrlAsync(
                  client.PhoneNumber ?? string.Empty,
                  prescription.Id,
                  cancellationToken);
                response.PaymentAmount = DecodingFeeAmount;
                response.PaymentCurrency = DecodingFeeCurrency;
            }
            catch
            {
                // Payment-settings outages shouldn't break the prescription
                // load — surface a null URL and let the client retry later.
            }
        }

        return response;
    }

    private static PrescriptionResponse MapToResponse(
      Prescription prescription,
      User? client = null,
      IReadOnlyDictionary<Guid, TempOfferStats>? tempOfferStats = null,
      IReadOnlyDictionary<Guid, string>? medicineTitles = null)
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
            PreferenceTier = prescription.PreferenceTier.ToString(),
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
              .Select(x =>
              {
                  TempOfferStats? stats = null;
                  if (x.LookupRequestId.HasValue
                    && tempOfferStats is not null
                    && tempOfferStats.TryGetValue(x.LookupRequestId.Value, out var found))
                  {
                      stats = found;
                  }

                  return new PrescriptionChecklistItemResponse
                  {
                      Id = x.Id,
                      MedicineId = x.MedicineId,
                      ManualMedicineName = x.ManualMedicineName,
                      MedicineTitle = x.MedicineId.HasValue
                        && medicineTitles is not null
                        && medicineTitles.TryGetValue(x.MedicineId.Value, out var medTitle)
                        ? medTitle
                        : null,
                      Quantity = x.Quantity,
                      PharmacistComment = x.PharmacistComment,
                      Kind = x.Kind.ToString(),
                      AnalogMedicineId = x.AnalogMedicineId,
                      AnalogItemId = x.AnalogItemId,
                      LookupRequestId = x.LookupRequestId,
                      // Manual lookup items: surface count + min price so the
                      // client UI can render them as ordinary orderable rows
                      // ("от X TJS · временное предложение в N аптеках") instead
                      // of the "Нет в каталоге" red badge. Null when this isn't
                      // a lookup item.
                      TemporaryOfferCount = x.LookupRequestId.HasValue
                        ? (stats?.OfferCount ?? 0)
                        : (int?)null,
                      TemporaryOfferMinPrice = stats?.MinPrice,
                      UseUnitMode = x.UseUnitMode,
                      UnitCount = x.UnitCount,
                      UnitTotalPrice = x.UnitTotalPrice
                  };
              })
              .ToList()
        };
    }

    /// <summary>
    /// Bulk-load catalog medicine titles for every checklist item across
    /// the supplied prescriptions. Catalog items keep showing their
    /// canonical name even after the medicine is later renamed/disabled
    /// (we still resolve by id), and manual rows fall back to their
    /// snapshot ManualMedicineName which is already on the row itself.
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, string>> LoadMedicineTitlesAsync(
      IEnumerable<Prescription> prescriptions,
      CancellationToken cancellationToken)
    {
        var medIds = prescriptions
          .SelectMany(p => p.Items)
          .Where(i => i.MedicineId.HasValue)
          .Select(i => i.MedicineId!.Value)
          .Distinct()
          .ToList();

        if (medIds.Count == 0)
            return new Dictionary<Guid, string>();

        return await _dbContext.Medicines
          .AsNoTracking()
          .Where(m => medIds.Contains(m.Id))
          .Select(m => new { m.Id, m.Title })
          .ToDictionaryAsync(m => m.Id, m => m.Title, cancellationToken);
    }

    /// <summary>
    /// Bulk-load `(lookupRequestId → temp-offer aggregate)` for every manual
    /// lookup item in the supplied prescriptions. Single GROUP BY query —
    /// avoids N+1 over checklist items.
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, TempOfferStats>> LoadTempOfferStatsAsync(
      IEnumerable<Prescription> prescriptions,
      CancellationToken cancellationToken)
    {
        var lookupIds = prescriptions
          .SelectMany(p => p.Items)
          .Where(i => i.LookupRequestId.HasValue)
          .Select(i => i.LookupRequestId!.Value)
          .Distinct()
          .ToList();

        if (lookupIds.Count == 0)
            return new Dictionary<Guid, TempOfferStats>();

        // Shadow medicines carry the lookup-request fk; shadow offers
        // attach to those medicines. Group by lookup so per-item stats
        // are a dict lookup away.
        var rows = await _dbContext.Medicines
          .AsNoTracking()
          .Where(m => m.ManualLookupRequestId.HasValue
                  && lookupIds.Contains(m.ManualLookupRequestId.Value))
          .Join(
            _dbContext.Offers.AsNoTracking(),
            m => m.Id,
            o => o.MedicineId,
            (m, o) => new { LookupRequestId = m.ManualLookupRequestId!.Value, o.Price })
          .GroupBy(x => x.LookupRequestId)
          .Select(g => new
          {
              LookupRequestId = g.Key,
              OfferCount = g.Count(),
              MinPrice = g.Min(x => x.Price)
          })
          .ToListAsync(cancellationToken);

        return rows.ToDictionary(
          r => r.LookupRequestId,
          r => new TempOfferStats
          {
              OfferCount = r.OfferCount,
              MinPrice = r.MinPrice
          });
    }

    private sealed class TempOfferStats
    {
        public required int OfferCount { get; init; }
        public required decimal MinPrice { get; init; }
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
