namespace Yalla.Application.DTO.Request;

public sealed class CheckoutBasketRequest
{
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public bool IsPickup { get; init; }
  public string DeliveryAddress { get; init; } = string.Empty;
  public long? DeliveryAddressId { get; init; }
  public string? DeliveryAddressTitle { get; init; }
  public double? DeliveryLatitude { get; init; }
  public double? DeliveryLongitude { get; init; }
  public string IdempotencyKey { get; init; } = string.Empty;
  public IReadOnlyCollection<Guid> IgnoredPositionIds { get; init; } = [];

  /// <summary>Optional free-form comment for the order (max 1024).</summary>
  public string? Comment { get; init; }

  /// <summary>Подъезд / building entrance. Optional, non-negative.</summary>
  public int? Entrance { get; init; }

  /// <summary>Этаж / floor. Optional, non-negative.</summary>
  public int? Floor { get; init; }

  /// <summary>Квартира / apartment number. Optional, non-negative.</summary>
  public int? Apartment { get; init; }

  /// <summary>
  /// Where the order positions come from. If null — defaults to
  /// <see cref="CheckoutSourceKind.Basket"/> (backward-compatible). When the
  /// source is non-basket, the basket is not touched.
  /// </summary>
  public CheckoutSourceRequest? Source { get; init; }
}
