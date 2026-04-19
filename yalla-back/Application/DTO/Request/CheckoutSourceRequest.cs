namespace Yalla.Application.DTO.Request;

public enum CheckoutSourceKind
{
  /// <summary>Default — resolve positions from the client's basket. Accepted positions are removed from the basket on success.</summary>
  Basket = 0,

  /// <summary>Repeat an existing order (owned by the same client). Basket is not touched.</summary>
  RepeatOrder = 1,

  /// <summary>Client-supplied positions (e.g. "Buy now", 3rd-party integrations). Basket is not touched.</summary>
  Explicit = 2
}

public sealed class CheckoutSourceRequest
{
  public CheckoutSourceKind Kind { get; init; } = CheckoutSourceKind.Basket;

  /// <summary>Required when <see cref="Kind"/> is <see cref="CheckoutSourceKind.RepeatOrder"/>.</summary>
  public Guid? RepeatOfOrderId { get; init; }

  /// <summary>Required when <see cref="Kind"/> is <see cref="CheckoutSourceKind.Explicit"/>.</summary>
  public IReadOnlyCollection<CheckoutPositionDraftRequest>? Positions { get; init; }
}

public sealed class CheckoutPositionDraftRequest
{
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
}
