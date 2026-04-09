using Yalla.Domain.Exceptions;
using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

public class Client : User
{
    private readonly List<BasketPosition> _basketPositions = new();

    private readonly List<Order> _orders = new();

    public IReadOnlyCollection<Order> Orders => _orders.AsReadOnly();

    public IReadOnlyCollection<BasketPosition> BasketPositions => _basketPositions.AsReadOnly();


    private Client() : base() { }

    public Client(string name, string phoneNumber, string passwordHash)
      : base(Guid.NewGuid(), name, phoneNumber, passwordHash, Role.Client)
    {
    }

    public Client(string name, long telegramId)
      : base(Guid.NewGuid(), name, telegramId, Role.Client)
    {
    }

    public Client(string name, string phoneNumber)
      : base(Guid.NewGuid(), name, phoneNumber, Role.Client)
    {
    }

    public Client(
      Guid id,
      string name,
      string phoneNumber,
      string passwordHash,
      Role role,
      List<Order> orders)
      : base(id, name, phoneNumber, passwordHash, role)
    {
        if (orders is null)
            throw new DomainArgumentException("Orders can't be null.");

        _orders.AddRange(orders);
    }


    public void AddOrder(Order? order)
    {
        if (order is null)
            throw new DomainArgumentException("Order can't be null.");

        _orders.Add(order);
    }

    public void RemoveOrder(Order? order)
    {
        if (order is null)
            throw new DomainArgumentException("Order can't be null.");

        _orders.Remove(order);
    }

    public void AddBasketPosition(BasketPosition? basketPosition)
    {
        if (basketPosition is null)
            throw new DomainArgumentException("BasketPosition can't be null.");

        _basketPositions.Add(basketPosition);
    }

    public void RemoveBasketPosition(BasketPosition? basketPosition)
    {
        if (basketPosition is null)
            throw new DomainArgumentException("BasketPosition can't be null.");

        _basketPositions.Remove(basketPosition);
    }
}
