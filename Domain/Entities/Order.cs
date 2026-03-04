using Yalla.Domain.Exceptions;

using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

public class Order
{
  public Guid Id { get; private set; }

  public Guid ClientId { get; private set; }

  public string DeliveryAddress { get; private set; } = string.Empty;

  public decimal Cost { get; private set; } = 0;

  public decimal ReturnCost {get; private set;} = 0;

  public Status Status { get; private set; } = Status.New;

  private readonly List<Position> _positions = new();

  private readonly List<Position> _rejectedPositions = new();

  private readonly List<PharmacyOrder> _pharmacyOrders = new();

  public IReadOnlyCollection<Position> Positions => _positions.AsReadOnly();

  public IReadOnlyCollection<Position> RejectedPositions => _rejectedPositions.AsReadOnly();

  public IReadOnlyCollection<PharmacyOrder> PharmacyOrders => _pharmacyOrders.AsReadOnly();


  private Order() {}

  public Order(Guid clientId, string deliveryAddress, List<Position> positions)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientId can't be empty.");

    if (string.IsNullOrWhiteSpace(deliveryAddress))
      throw new DomainArgumentException("DeliveryAddress can't be null or whitespace.");

    if (positions.Any(p => p.Medicine is null))
      throw new DomainArgumentException("Position.Medicine can't be null.");

    Id = Guid.NewGuid();
    ClientId = clientId;
    DeliveryAddress = deliveryAddress;
    _positions.AddRange(positions);
  }



  private void CalculateCost()
  {
    if (_positions.Any(p => p.CapturedOffer is null))
      throw new DomainArgumentException("All positions must have CapturedOffer before calculating Cost.");

    var confirmed = _positions.Where(p => !_rejectedPositions.Contains(p)).ToList();

    decimal result = 0;

    confirmed.ForEach(p => result += p.CapturedOffer.Price * p.Quantity);
    

    Cost = result;
  }

  private void CalculateReturnCost()
  {
    if (_rejectedPositions.Any(p => p.CapturedOffer is null))
      throw new DomainArgumentException("Return cost can be calculated only in Ready status and rejected positions must have CapturedOffer.");

    decimal result = 0;

    _rejectedPositions.ForEach(p => result += p.CapturedOffer.Price * p.Quantity);

    ReturnCost = result;
  }

  public void NextStage(bool IsNotCancelled)
  {
    if (!IsNotCancelled)
    {
      if ((int)Status >= (int)Status.Ready)
        throw new DomainException("Cannot cancel order the is already on the way or iz delivered");

      Status = Status.Cancelled;
      return;
    }

    switch(Status)
    {
      case Status.Cancelled:
        throw new DomainArgumentException("Order can't transition from Cancelled status.");
      case Status.Returned:
        throw new DomainArgumentException("Order can't transition from Returned status.");
      case Status.New:
        Status = Status.UnderReview;
        break;
      case Status.UnderReview:
        DistinctToPharmacyOrders();
        Status = Status.Preparing;
        break;
      case Status.Preparing:
        FillRejections();
        CalculateCost();
        CalculateReturnCost();
        Status = Status.Ready;
        break;
      case Status.Ready:
        Status = Status.OnTheWay;
        break;
      case Status.OnTheWay:
        Status = Status.Delivered;
        break;
      case Status.Delivered:
        Status = Status.Returned;
        break;
    }
  }

  private void DistinctToPharmacyOrders()
  {
    if (_positions.Any(p => p.CapturedOffer is null))
      throw new DomainArgumentException("DistinctToPharmacyOrders requires Preparing status and positions with CapturedOffer.");

    var groupedPositions = _positions.GroupBy(p => p.CapturedOffer.PharmacyId);

    List<PharmacyOrder> pharmacyOrders = new();

    foreach (var x in groupedPositions)
    {
      pharmacyOrders.Add(new PharmacyOrder(x.Key, Id, x.ToList()));
    }

    _pharmacyOrders.Clear();
    _pharmacyOrders.AddRange(pharmacyOrders);
  }

  private void FillRejections()
  {
    foreach(var pharmacyOrder in _pharmacyOrders)
    {
      _rejectedPositions.AddRange(pharmacyOrder.RejectedPositions);
    }
  }

}
