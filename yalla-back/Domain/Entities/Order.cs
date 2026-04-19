using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Order
{
    private static readonly TimeSpan UtcPlus5Offset = TimeSpan.FromHours(5);

    public Guid Id { get; private set; }

    public Guid? ClientId { get; private set; }

    public string ClientPhoneNumber { get; private set; } = string.Empty;

    public Guid PharmacyId { get; private set; }

    public string DeliveryAddress { get; private set; } = string.Empty;

    public bool IsPickup { get; private set; }

    public string? IdempotencyKey { get; private set; }

    public DateTime OrderPlacedAt { get; private set; }

    public decimal Cost { get; private set; }

    public decimal ReturnCost { get; private set; }

    public Status Status { get; private set; } = Status.New;

    public OrderPaymentState PaymentState { get; private set; } = OrderPaymentState.Confirmed;

    public decimal PaymentAmount { get; private set; }

    public string PaymentCurrency { get; private set; } = "TJS";

    public string PaymentProvider { get; private set; } = "Legacy";

    public string PaymentReceiverAccount { get; private set; } = string.Empty;

    public string? PaymentUrl { get; private set; }

    public string? PaymentComment { get; private set; }

    public DateTime? PaymentExpiresAtUtc { get; private set; }

    public DateTime? PaymentConfirmedAtUtc { get; private set; }

    public Guid? PaymentConfirmedByUserId { get; private set; }

    public bool IsStockDeducted { get; private set; } = true;

    /// <summary>Optional free-form comment left by the client at checkout (max 1024).</summary>
    public string? Comment { get; private set; }

    private readonly List<OrderPosition> _positions = new();

    public IReadOnlyCollection<OrderPosition> Positions => _positions.AsReadOnly();

    public DeliveryData? DeliveryData { get; private set; }

    private Order() { }

    public Order(
      Guid id,
      Guid clientId,
      string clientPhoneNumber,
      Guid pharmacyId,
      string deliveryAddress,
      List<OrderPosition> positions,
      string? idempotencyKey = null,
      DateTime? orderPlacedAt = null,
      bool isPickup = false,
      string? comment = null)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("Id can't be empty.");

        if (clientId == Guid.Empty)
            throw new DomainArgumentException("ClientId can't be empty.");

        if (pharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        var normalizedClientPhoneNumber = NormalizeClientPhoneNumber(clientPhoneNumber);

        if (string.IsNullOrWhiteSpace(deliveryAddress))
            throw new DomainArgumentException("DeliveryAddress can't be null or whitespace.");

        if (positions is null || positions.Count == 0)
            throw new DomainArgumentException("Order must contain at least one position.");

        if (positions.Any(p => p.Medicine is null))
            throw new DomainArgumentException("OrderPosition.Medicine can't be null.");

        if (positions.Any(p => p.OfferSnapshot.PharmacyId != pharmacyId))
            throw new DomainArgumentException("All positions must belong to Order.PharmacyId.");

        if (positions.Any(p => p.OrderId != id))
            throw new DomainArgumentException("All positions must belong to Order.Id.");

        Id = id;
        ClientId = clientId;
        ClientPhoneNumber = normalizedClientPhoneNumber;
        PharmacyId = pharmacyId;
        DeliveryAddress = deliveryAddress;
        IsPickup = isPickup;
        IdempotencyKey = NormalizeIdempotencyKey(idempotencyKey);
        OrderPlacedAt = orderPlacedAt.HasValue
          ? NormalizeUtcPlus5ToSeconds(orderPlacedAt.Value)
          : GetUtcPlus5NowToSeconds();

        _positions.AddRange(positions);
        RecalculateTotals();
        PaymentAmount = Cost;
        PaymentConfirmedAtUtc = DateTime.UtcNow;
        Comment = NormalizeOptionalString(comment, 1024, "Comment");
    }

    public void SetComment(string? comment)
    {
        Comment = NormalizeOptionalString(comment, 1024, "Comment");
    }

    public void RecalculateTotals()
    {
        // Cost = what the client still owes after rejects/returns (net of refunds).
        // ReturnCost = total refund-due: rejected-positions value + returned-quantity value.
        // Invariant: Cost + ReturnCost == sum(price * Quantity) for all positions.
        Cost = _positions
          .Where(x => !x.IsRejected)
          .Sum(x => x.OfferSnapshot.Price * (x.Quantity - x.ReturnedQuantity));

        ReturnCost = _positions
          .Where(x => x.IsRejected)
          .Sum(x => x.OfferSnapshot.Price * x.Quantity)
          + _positions
          .Where(x => !x.IsRejected)
          .Sum(x => x.OfferSnapshot.Price * x.ReturnedQuantity);
    }

    /// <summary>
    /// SuperAdmin-side return: for each delivered non-rejected position, record
    /// how many units came back. Allowed only when the order has already been
    /// delivered (<see cref="Status.Delivered"/>) or picked up (<see cref="Status.PickedUp"/>).
    /// Sets the status to <see cref="Status.Returned"/>. The original completion
    /// mode (pickup/delivery) stays derivable from <see cref="IsPickup"/>.
    /// </summary>
    public void InitiateReturn(IReadOnlyDictionary<Guid, int> returnedByPositionId)
    {
        if (returnedByPositionId is null || returnedByPositionId.Count == 0)
            throw new DomainArgumentException("Return request must contain at least one position.");

        if (Status is not Status.Delivered and not Status.PickedUp and not Status.Returned)
            throw new DomainException($"Return is only allowed from Delivered/PickedUp (current: {Status}).");

        foreach (var (positionId, qty) in returnedByPositionId)
        {
            var position = _positions.FirstOrDefault(p => p.Id == positionId)
              ?? throw new DomainArgumentException($"Position '{positionId}' doesn't belong to this order.");

            if (position.IsRejected)
                throw new DomainArgumentException($"Position '{positionId}' was rejected and can't be returned.");

            // qty here is the TOTAL returned so far for this position (idempotent updates).
            position.SetReturnedQuantity(qty);
        }

        RecalculateTotals();
        Status = Status.Returned;
    }

    public void NextStage(bool isNotCancelled)
    {
        if (!isNotCancelled)
        {
            Cancel();
            return;
        }

        switch (Status)
        {
            case Status.Cancelled:
                throw new DomainArgumentException("Order can't transition from Cancelled status.");
            case Status.Returned:
                throw new DomainArgumentException("Order can't transition from Returned status.");
            case Status.New:
                Status = Status.UnderReview;
                break;
            case Status.UnderReview:
                Status = Status.Preparing;
                break;
            case Status.Preparing:
                RecalculateTotals();
                Status = Status.Ready;
                break;
            case Status.Ready:
                Status = IsPickup
                  ? Status.PickedUp
                  : Status.OnTheWay;
                break;
            case Status.OnTheWay:
                Status = Status.Delivered;
                break;
            case Status.DriverArrived:
                Status = Status.Delivered;
                break;
            case Status.Delivered:
            case Status.PickedUp:
                Status = Status.Returned;
                break;
        }
    }

    /// <summary>
    /// Delivery-service driven transition: courier physically started moving the
    /// package towards the client. Allowed only from <see cref="Status.Ready"/>.
    /// Idempotent if already in <see cref="Status.OnTheWay"/>.
    /// </summary>
    public void MarkOnTheWayFromDelivery()
    {
        if (IsPickup)
            throw new DomainException("Pickup orders can't enter OnTheWay from a delivery signal.");

        if (Status == Status.OnTheWay)
            return;
        if (Status != Status.Ready)
            throw new DomainException($"Cannot move to OnTheWay from status '{Status}'.");

        Status = Status.OnTheWay;
    }

    /// <summary>Courier arrived at client address (JURA 4 after 7). Allowed only from OnTheWay.</summary>
    public void MarkDriverArrivedFromDelivery()
    {
        if (IsPickup)
            throw new DomainException("Pickup orders can't have DriverArrived.");

        if (Status == Status.DriverArrived)
            return;
        if (Status != Status.OnTheWay)
            throw new DomainException($"Cannot move to DriverArrived from status '{Status}'.");

        Status = Status.DriverArrived;
    }

    /// <summary>Delivery completed. Allowed from OnTheWay/DriverArrived.</summary>
    public void MarkDeliveredFromDelivery()
    {
        if (Status == Status.Delivered)
            return;
        if (Status is not (Status.OnTheWay or Status.DriverArrived))
            throw new DomainException($"Cannot move to Delivered from status '{Status}'.");

        Status = Status.Delivered;
    }

    public void Cancel()
    {
        if (Status == Status.Cancelled)
            throw new DomainException("Order is already cancelled.");

        // Terminal states can't be cancelled (delivered, picked up, returned, already cancelled).
        if (Status is Status.Delivered or Status.PickedUp or Status.Returned)
            throw new DomainException("Cannot cancel order that is already completed or returned.");

        Status = Status.Cancelled;
    }

    public void DetachClient(string? fallbackPhoneNumber = null)
    {
        if (ClientId is null)
            return;

        if (string.IsNullOrWhiteSpace(ClientPhoneNumber))
            ClientPhoneNumber = NormalizeClientPhoneNumber(fallbackPhoneNumber ?? string.Empty);

        ClientId = null;
    }

    public void MarkManualPaymentPending(
      decimal amount,
      string currency,
      string provider,
      string receiverAccount,
      string? paymentUrl,
      string? paymentComment,
      DateTime expiresAtUtc)
    {
        if (amount <= 0)
            throw new DomainArgumentException("Payment amount must be greater than zero.");

        if (expiresAtUtc <= DateTime.UtcNow)
            throw new DomainArgumentException("Payment expiration must be in the future.");

        PaymentAmount = amount;
        PaymentCurrency = NormalizeRequiredString(currency, 8, "PaymentCurrency").ToUpperInvariant();
        PaymentProvider = NormalizeRequiredString(provider, 64, "PaymentProvider");
        PaymentReceiverAccount = NormalizeRequiredString(receiverAccount, 128, "PaymentReceiverAccount");
        PaymentUrl = NormalizeOptionalString(paymentUrl, 2048, "PaymentUrl");
        PaymentComment = NormalizeOptionalString(paymentComment, 512, "PaymentComment");
        PaymentState = OrderPaymentState.PendingManualConfirmation;
        PaymentExpiresAtUtc = expiresAtUtc;
        PaymentConfirmedAtUtc = null;
        PaymentConfirmedByUserId = null;
    }

    public void MarkManualPaymentPendingIndefinitely(
      decimal amount,
      string currency,
      string provider,
      string receiverAccount,
      string? paymentUrl,
      string? paymentComment)
    {
        if (amount <= 0)
            throw new DomainArgumentException("Payment amount must be greater than zero.");

        PaymentAmount = amount;
        PaymentCurrency = NormalizeRequiredString(currency, 8, "PaymentCurrency").ToUpperInvariant();
        PaymentProvider = NormalizeRequiredString(provider, 64, "PaymentProvider");
        PaymentReceiverAccount = NormalizeRequiredString(receiverAccount, 128, "PaymentReceiverAccount");
        PaymentUrl = NormalizeOptionalString(paymentUrl, 2048, "PaymentUrl");
        PaymentComment = NormalizeOptionalString(paymentComment, 512, "PaymentComment");
        PaymentState = OrderPaymentState.PendingManualConfirmation;
        PaymentExpiresAtUtc = null;
        PaymentConfirmedAtUtc = null;
        PaymentConfirmedByUserId = null;
    }

    public void ConfirmManualPayment(Guid confirmedByUserId, DateTime confirmedAtUtc)
    {
        if (confirmedByUserId == Guid.Empty)
            throw new DomainArgumentException("ConfirmedByUserId can't be empty.");

        if (PaymentState != OrderPaymentState.PendingManualConfirmation)
            throw new DomainException($"Order payment can't be confirmed from state '{PaymentState}'.");

        if (PaymentExpiresAtUtc.HasValue && PaymentExpiresAtUtc.Value <= confirmedAtUtc)
            throw new DomainException("Order payment confirmation window has expired.");

        PaymentState = OrderPaymentState.Confirmed;
        PaymentConfirmedAtUtc = confirmedAtUtc;
        PaymentConfirmedByUserId = confirmedByUserId;
    }

    public void MarkManualPaymentExpired(DateTime expiredAtUtc)
    {
        if (PaymentState != OrderPaymentState.PendingManualConfirmation)
            return;

        PaymentState = OrderPaymentState.Expired;
        PaymentConfirmedAtUtc = null;
        PaymentConfirmedByUserId = null;
        if (!PaymentExpiresAtUtc.HasValue)
            PaymentExpiresAtUtc = expiredAtUtc;
    }

    public void MarkManualPaymentConfirmed(
      decimal amount,
      string currency,
      string provider,
      string receiverAccount,
      string? paymentUrl,
      string? paymentComment,
      Guid confirmedByUserId,
      DateTime confirmedAtUtc)
    {
        if (amount <= 0)
            throw new DomainArgumentException("Payment amount must be greater than zero.");

        if (confirmedByUserId == Guid.Empty)
            throw new DomainArgumentException("ConfirmedByUserId can't be empty.");

        PaymentAmount = amount;
        PaymentCurrency = NormalizeRequiredString(currency, 8, "PaymentCurrency").ToUpperInvariant();
        PaymentProvider = NormalizeRequiredString(provider, 64, "PaymentProvider");
        PaymentReceiverAccount = NormalizeRequiredString(receiverAccount, 128, "PaymentReceiverAccount");
        PaymentUrl = NormalizeOptionalString(paymentUrl, 2048, "PaymentUrl");
        PaymentComment = NormalizeOptionalString(paymentComment, 512, "PaymentComment");
        PaymentState = OrderPaymentState.Confirmed;
        PaymentExpiresAtUtc = null;
        PaymentConfirmedByUserId = confirmedByUserId;
        PaymentConfirmedAtUtc = confirmedAtUtc.Kind == DateTimeKind.Utc
          ? confirmedAtUtc
          : confirmedAtUtc.ToUniversalTime();
    }

    public void MarkStockNotDeducted() => IsStockDeducted = false;

    public void MarkStockDeducted() => IsStockDeducted = true;

    private static DateTime GetUtcPlus5NowToSeconds()
    {
        var now = DateTimeOffset.UtcNow.ToOffset(UtcPlus5Offset);
        return new DateTime(
          now.Year,
          now.Month,
          now.Day,
          now.Hour,
          now.Minute,
          now.Second,
          DateTimeKind.Unspecified);
    }

    private static DateTime NormalizeUtcPlus5ToSeconds(DateTime value)
    {
        var valueWithOffset = value.Kind == DateTimeKind.Unspecified
          ? new DateTimeOffset(value, UtcPlus5Offset)
          : new DateTimeOffset(value).ToOffset(UtcPlus5Offset);

        return new DateTime(
          valueWithOffset.Year,
          valueWithOffset.Month,
          valueWithOffset.Day,
          valueWithOffset.Hour,
          valueWithOffset.Minute,
          valueWithOffset.Second,
          DateTimeKind.Unspecified);
    }

    private static string? NormalizeIdempotencyKey(string? idempotencyKey)
    {
        if (idempotencyKey is null)
            return null;

        var normalized = idempotencyKey.Trim();
        if (normalized.Length == 0)
            throw new DomainArgumentException("IdempotencyKey can't be whitespace.");

        if (normalized.Length > 128)
            throw new DomainArgumentException("IdempotencyKey length can't exceed 128.");

        return normalized;
    }

    private static string NormalizeClientPhoneNumber(string clientPhoneNumber)
    {
        // Phone is optional — Telegram-only clients keep this empty. When
        // provided, it must still be a valid 9-digit number.
        if (string.IsNullOrWhiteSpace(clientPhoneNumber))
            return string.Empty;

        var digitsOnly = new string(clientPhoneNumber
          .Where(char.IsDigit)
          .ToArray());

        if (digitsOnly.StartsWith("992", StringComparison.Ordinal) && digitsOnly.Length == 12)
            digitsOnly = digitsOnly[3..];

        if (digitsOnly.Length != 9)
            throw new DomainArgumentException("ClientPhoneNumber must contain exactly 9 digits.");

        return digitsOnly;
    }

    private static string NormalizeRequiredString(string value, int maxLength, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainArgumentException($"{fieldName} can't be null or whitespace.");

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
            throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

        return normalized;
    }

    private static string? NormalizeOptionalString(string? value, int maxLength, string fieldName)
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
}
