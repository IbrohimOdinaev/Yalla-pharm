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

  /// <summary>
  /// When <see cref="Kind"/> is <see cref="CheckoutSourceKind.Explicit"/>, setting this to
  /// <c>true</c> will remove basket positions whose MedicineId matches an ordered draft after
  /// the order is successfully created. Intended for the authenticated cart-checkout flow where
  /// the caller explicitly selects a subset of basket items for a pharmacy. Ignored for other kinds.
  /// </summary>
  public bool ConsumeFromBasket { get; init; }
}

public sealed class CheckoutPositionDraftRequest
{
  public Guid MedicineId { get; init; }
  public int Quantity { get; init; }
}
