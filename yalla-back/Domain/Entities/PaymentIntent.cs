using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class PaymentIntent
{
  private readonly List<PaymentIntentPosition> _positions = new();

  public Guid Id { get; private set; }
  public Guid ReservedOrderId { get; private set; }
  public Guid ClientId { get; private set; }
  public string ClientPhoneNumber { get; private set; } = string.Empty;
  public Guid PharmacyId { get; private set; }
  public bool IsPickup { get; private set; }
  public string DeliveryAddress { get; private set; } = string.Empty;
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = string.Empty;
  public string PaymentProvider { get; private set; } = string.Empty;
  public string PaymentReceiverAccount { get; private set; } = string.Empty;
  public string? PaymentUrl { get; private set; }
  public string? PaymentComment { get; private set; }
  public PaymentIntentState State { get; private set; }
  public string IdempotencyKey { get; private set; } = string.Empty;
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }
  public DateTime? ConfirmedAtUtc { get; private set; }
  public Guid? ConfirmedByUserId { get; private set; }
  public string? RejectReason { get; private set; }
  public int? Entrance { get; private set; }
  public int? Floor { get; private set; }
  public int? Apartment { get; private set; }

  public IReadOnlyCollection<PaymentIntentPosition> Positions => _positions.AsReadOnly();

  private PaymentIntent()
  {
  }

  public PaymentIntent(
    Guid reservedOrderId,
    Guid clientId,
    string clientPhoneNumber,
    Guid pharmacyId,
    bool isPickup,
    string deliveryAddress,
    decimal amount,
    string currency,
    string paymentProvider,
    string paymentReceiverAccount,
    string? paymentUrl,
    string? paymentComment,
    string idempotencyKey,
    IReadOnlyCollection<PaymentIntentPosition> positions,
    DateTime createdAtUtc,
    int? entrance = null,
    int? floor = null,
    int? apartment = null)
  {
    if (reservedOrderId == Guid.Empty)
      throw new DomainArgumentException("ReservedOrderId can't be empty.");

    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");

    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    if (amount <= 0m)
      throw new DomainArgumentException("Amount must be greater than zero.");

    var normalizedPhoneNumber = NormalizePhoneNumber(clientPhoneNumber, nameof(ClientPhoneNumber));
    var normalizedDeliveryAddress = NormalizeRequired(deliveryAddress, 500, nameof(DeliveryAddress));
    var normalizedCurrency = NormalizeRequired(currency, 8, nameof(Currency));
    var normalizedProvider = NormalizeRequired(paymentProvider, 64, nameof(PaymentProvider));
    var normalizedReceiverAccount = NormalizeRequired(paymentReceiverAccount, 128, nameof(PaymentReceiverAccount));
    var normalizedIdempotencyKey = NormalizeRequired(idempotencyKey, 128, nameof(IdempotencyKey));
    var normalizedPaymentUrl = NormalizeOptional(paymentUrl, 2048, nameof(PaymentUrl));
    var normalizedPaymentComment = NormalizeOptional(paymentComment, 512, nameof(PaymentComment));
    var normalizedCreatedAtUtc = NormalizeUtc(createdAtUtc, nameof(CreatedAtUtc));

    if (positions is null || positions.Count == 0)
      throw new DomainArgumentException("PaymentIntent must contain at least one position.");

    if (positions.Any(x => x.PaymentIntentId != Guid.Empty))
      throw new DomainArgumentException("Position.PaymentIntentId must be empty before intent creation.");

    Id = Guid.NewGuid();
    ReservedOrderId = reservedOrderId;
    ClientId = clientId;
    ClientPhoneNumber = normalizedPhoneNumber;
    PharmacyId = pharmacyId;
    IsPickup = isPickup;
    DeliveryAddress = normalizedDeliveryAddress;
    Amount = amount;
    Currency = normalizedCurrency.ToUpperInvariant();
    PaymentProvider = normalizedProvider;
    PaymentReceiverAccount = normalizedReceiverAccount;
    PaymentUrl = normalizedPaymentUrl;
    PaymentComment = normalizedPaymentComment;
    IdempotencyKey = normalizedIdempotencyKey;
    State = PaymentIntentState.AwaitingAdminConfirmation;
    CreatedAtUtc = normalizedCreatedAtUtc;
    UpdatedAtUtc = normalizedCreatedAtUtc;
    ConfirmedAtUtc = null;
    ConfirmedByUserId = null;
    RejectReason = null;
    Entrance = NormalizeNonNegativeInt(entrance, nameof(Entrance));
    Floor = NormalizeNonNegativeInt(floor, nameof(Floor));
    Apartment = NormalizeNonNegativeInt(apartment, nameof(Apartment));

    foreach (var position in positions)
      _positions.Add(position.AttachToPaymentIntent(Id));
  }

  private static int? NormalizeNonNegativeInt(int? value, string name)
  {
    if (value is null) return null;
    if (value.Value < 0)
      throw new DomainArgumentException($"{name} can't be negative.");
    return value.Value;
  }

  public void MarkConfirmed(Guid confirmedByUserId, DateTime confirmedAtUtc)
  {
    if (confirmedByUserId == Guid.Empty)
      throw new DomainArgumentException("ConfirmedByUserId can't be empty.");

    if (State != PaymentIntentState.AwaitingAdminConfirmation)
      throw new DomainException($"PaymentIntent can't be confirmed from state '{State}'.");

    State = PaymentIntentState.Confirmed;
    ConfirmedByUserId = confirmedByUserId;
    ConfirmedAtUtc = NormalizeUtc(confirmedAtUtc, nameof(ConfirmedAtUtc));
    RejectReason = null;
    UpdatedAtUtc = ConfirmedAtUtc.Value;
  }

  public void MarkRejected(string reason, DateTime updatedAtUtc)
  {
    if (State == PaymentIntentState.Confirmed)
      throw new DomainException("Confirmed payment intent can't be rejected.");

    var normalizedReason = NormalizeRequired(reason, 512, nameof(RejectReason));
    var normalizedUpdatedAtUtc = NormalizeUtc(updatedAtUtc, nameof(UpdatedAtUtc));

    State = PaymentIntentState.Rejected;
    RejectReason = normalizedReason;
    ConfirmedAtUtc = null;
    ConfirmedByUserId = null;
    UpdatedAtUtc = normalizedUpdatedAtUtc;
  }

  public void MarkNeedsResolution(string reason, DateTime updatedAtUtc)
  {
    if (State == PaymentIntentState.Confirmed)
      throw new DomainException("Confirmed payment intent can't be moved to NeedsResolution.");

    var normalizedReason = NormalizeRequired(reason, 512, nameof(RejectReason));
    var normalizedUpdatedAtUtc = NormalizeUtc(updatedAtUtc, nameof(UpdatedAtUtc));

    State = PaymentIntentState.NeedsResolution;
    RejectReason = normalizedReason;
    UpdatedAtUtc = normalizedUpdatedAtUtc;
  }

  public void Touch(DateTime updatedAtUtc)
  {
    UpdatedAtUtc = NormalizeUtc(updatedAtUtc, nameof(UpdatedAtUtc));
  }

  private static DateTime NormalizeUtc(DateTime value, string fieldName)
  {
    var normalized = value.Kind switch
    {
      DateTimeKind.Utc => value,
      DateTimeKind.Local => value.ToUniversalTime(),
      _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    if (normalized == DateTime.MinValue || normalized == DateTime.MaxValue)
      throw new DomainArgumentException($"{fieldName} is out of allowed range.");

    return normalized;
  }

  private static string NormalizeRequired(string value, int maxLength, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException($"{fieldName} can't be null or whitespace.");

    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static string? NormalizeOptional(string? value, int maxLength, string fieldName)
  {
    if (value is null)
      return null;

    var normalized = value.Trim();
    if (normalized.Length == 0)
      return null;

    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static string NormalizePhoneNumber(string value, string fieldName)
  {
    // Phone is optional at checkout — Telegram-only clients keep this empty.
    if (string.IsNullOrWhiteSpace(value))
      return string.Empty;

    var digitsOnly = new string(value.Where(char.IsDigit).ToArray());
    if (digitsOnly.StartsWith("992", StringComparison.Ordinal) && digitsOnly.Length == 12)
      digitsOnly = digitsOnly[3..];

    if (digitsOnly.Length != 9)
      throw new DomainArgumentException($"{fieldName} must contain exactly 9 digits.");

    return digitsOnly;
  }
}
