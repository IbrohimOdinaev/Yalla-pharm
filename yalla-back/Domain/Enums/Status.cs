namespace Yalla.Domain.Enums;

public enum Status
{
  New = 0,
  UnderReview = 1,
  Preparing = 2,
  Ready = 3,
  OnTheWay = 4,
  Delivered = 5,
  Cancelled = 6,
  Returned = 7,
  /// <summary>Pickup analogue of <see cref="Delivered"/> — client picked up the order at the pharmacy.</summary>
  PickedUp = 8,
  /// <summary>Delivery-only: courier arrived at the client's address (JURA status_id=4 after transit).</summary>
  DriverArrived = 9
}
