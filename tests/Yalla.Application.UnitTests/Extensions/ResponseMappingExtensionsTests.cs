using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.UnitTests.Extensions;

public class ResponseMappingExtensionsTests
{
  [Fact]
  public void BasketPosition_ToResponse_MapsFields()
  {
    var medicine = TestDbFactory.CreateMedicine("Aspirin", "A-1");
    var position = new BasketPosition(Guid.NewGuid(), Guid.NewGuid(), medicine.Id, medicine, 2);

    var response = position.ToResponse();

    Assert.Equal(position.Id, response.PositionId);
    Assert.Equal(position.MedicineId, response.MedicineId);
    Assert.Equal(2, response.Quantity);
  }

  [Fact]
  public void Order_ToResponse_MapsCoreFields()
  {
    var medicine = TestDbFactory.CreateMedicine("Ibuprofen", "IBU-2");
    var orderId = Guid.NewGuid();
    var pharmacyId = Guid.NewGuid();
    var order = new Order(
      orderId,
      Guid.NewGuid(),
      pharmacyId,
      "Dushanbe",
      [
        new OrderPosition(
          orderId,
          medicine.Id,
          medicine,
          new OfferSnapshot(pharmacyId, 15m),
          1)
      ]);

    var response = order.ToResponse();

    Assert.Equal(order.Id, response.OrderId);
    Assert.Equal(order.ClientId, response.ClientId);
    Assert.Equal(order.Status, response.Status);
    Assert.Equal(order.Cost, response.Cost);
  }

  [Fact]
  public void Client_ToResponse_WithOrdersAndBasket_MapsCollections()
  {
    var client = TestDbFactory.CreateClient("U", "992100100");
    IReadOnlyCollection<BasketPositionResponse> basket =
    [
      new BasketPositionResponse { PositionId = Guid.NewGuid(), MedicineId = Guid.NewGuid(), Quantity = 1 }
    ];
    IReadOnlyCollection<ClientOrderResponse> orders =
    [
      new ClientOrderResponse { OrderId = Guid.NewGuid(), PharmacyId = Guid.NewGuid(), Cost = 10, ReturnCost = 0 }
    ];

    var response = client.ToResponse(basket, orders);

    Assert.Single(response.BasketPositions);
    Assert.Single(response.Orders);
    Assert.Empty(response.PharmacyOptions);
  }
}
