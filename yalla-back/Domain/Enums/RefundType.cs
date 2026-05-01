namespace Yalla.Domain.Enums;

/// <summary>
/// Distinguishes refunds where the customer physically returns the product
/// (so stock must be replenished and goods accounted for) from refunds
/// where there is nothing to return (admin/client cancelled before delivery,
/// pharmacy rejected positions during preparation, JURA-cancelled delivery).
/// </summary>
public enum RefundType
{
  /// <summary>Order was cancelled / positions rejected before reaching the customer; nothing to ship back.</summary>
  WithoutProductReturn = 0,

  /// <summary>Customer received the product and is returning it; stock is restocked and money refunded.</summary>
  WithProductReturn = 1
}
