using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class PharmacyOrder
{
  public Guid Id { get; private set; }

  public Guid PharmacyId { get; private set; }

  public Guid OrderId { get; private set; }


  private readonly List<Position> _positions = new();

  private readonly List<Position> _rejectedPositions = new();

  public IReadOnlyCollection<Position> Positions => _positions.AsReadOnly();

  public IReadOnlyCollection<Position> RejectedPositions => _rejectedPositions.AsReadOnly();


  private PharmacyOrder() {}

  public PharmacyOrder(Guid pharmacyId, Guid orderId, List<Position> positions)
  {
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    Id = Guid.NewGuid();
    PharmacyId = pharmacyId;
    OrderId = orderId;
    _positions.AddRange(positions);
  }

  public PharmacyOrder(Guid id, Guid pharmacyId, Guid orderId, List<Position> positions, List<Position> rejectedPositions)
  {
    Id = id;
    PharmacyId = pharmacyId;
    OrderId = orderId;
    _positions.AddRange(positions);
    _rejectedPositions = rejectedPositions;
  }

  public void AddPosition(Position? position)
  {
    if (position is null)
      throw new DomainArgumentException("Position can't be null.");

    _positions.Add(position);
  }

  public void RemovePosition(Position? position)
  {
    if (position is null)
      throw new DomainArgumentException("Position can't be null.");

    _positions.Remove(position);
  }

  public void AddRejectedPosition(Position? position)
  {
    if (position is null)
      throw new DomainArgumentException("Rejected position can't be null.");

    _rejectedPositions.Add(position);
  }

  public void RemoveRejectedPosition(Position? position)
  { if (position is null)
      throw new DomainArgumentException("Rejected position can't be null.");

    _rejectedPositions.Remove(position);
  }

}
