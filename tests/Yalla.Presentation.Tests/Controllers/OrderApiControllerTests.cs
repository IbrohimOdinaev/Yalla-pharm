using Microsoft.AspNetCore.Mvc;

namespace Yalla.Presentation.Tests.Controllers;

public sealed class OrderApiControllerTests
{
    private static OrderApiController CreateController(
        Mock<IOrderService>? orderServiceMock = null,
        Mock<IPharmacyOrderService>? pharmacyOrderServiceMock = null,
        Mock<ITelegramService>? telegramServiceMock = null)
    {
        return new OrderApiController(
            (orderServiceMock ?? new Mock<IOrderService>()).Object,
            (pharmacyOrderServiceMock ?? new Mock<IPharmacyOrderService>()).Object,
            (telegramServiceMock ?? new Mock<ITelegramService>()).Object);
    }

    private static bool ExtractBooleanFromOk(IActionResult result)
    {
        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<bool>(ok.Value);
    }

    [Fact]
    public void Ctor_WhenOrderServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new OrderApiController(
            null!,
            new Mock<IPharmacyOrderService>().Object,
            new Mock<ITelegramService>().Object));
    }

    [Fact]
    public void Ctor_WhenPharmacyOrderServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new OrderApiController(
            new Mock<IOrderService>().Object,
            null!,
            new Mock<ITelegramService>().Object));
    }

    [Fact]
    public async Task DeleteOrderAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock.Setup(x => x.DeleteAsync(TestIds.Id("order-1"), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        bool result = await controller.DeleteOrderAsync("order-1");

        Assert.True(result);
        orderServiceMock.Verify(x => x.DeleteAsync(TestIds.Id("order-1"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteOrderAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock.Setup(x => x.DeleteAsync(TestIds.Id("order-1"), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        bool result = await controller.DeleteOrderAsync("order-1");

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateStateAsync_WhenCalled_ShouldReturnTrueWithoutCallingOrderService()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        UpdateOrderStateRequest dto = new() { OrderId = Guid.NewGuid(), State = OrderState.Delivered, CourierName = "Courier-1" };

        bool result = await controller.UpdateStateAsync(dto);

        Assert.True(result);
        orderServiceMock.Verify(x => x.UpdateStateAsync(It.IsAny<UpdateOrderStateRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void GetOrderNumber_WhenCalled_ShouldReturnServiceValue()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock.Setup(x => x.GetOrderNumber(TestIds.Id("order-1"))).Returns("N-1001");
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        string result = controller.GetOrderNumber(TestIds.Id("order-1"));

        Assert.Equal("N-1001", result);
    }

    [Fact]
    public async Task GetOrderAsync_WhenCalledByStateRoute_ShouldReturnOkWithCountAndOrders()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock
            .Setup(x => x.GetCountOrderByStateAsync(It.IsAny<OrderFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        orderServiceMock
            .Setup(x => x.GetByStateAsync(OrderState.Application, 10, "", It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new OrderResponse { Id = Guid.NewGuid() } }));

        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.GetOrderAsync(OrderState.Application, 10);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        object payload = ok.Value!;
        int count = (int)payload.GetType().GetProperty("Count")!.GetValue(payload)!;
        IEnumerable<OrderResponse> orders = (IEnumerable<OrderResponse>)payload.GetType().GetProperty("Orders")!.GetValue(payload)!;

        Assert.Equal(1, count);
        Assert.Single(orders);
    }

    [Fact]
    public async Task GetOrderAsync_WhenCalledByFilter_ShouldReturnOkWithCountAndOrders()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderFilterRequest filter = new() { State = OrderState.Placed, FromDate = DateTime.Today };
        orderServiceMock
            .Setup(x => x.GetCountOrderByStateAsync(filter, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);
        orderServiceMock
            .Setup(x => x.GetByStateAsync(filter, It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new OrderResponse { Id = Guid.NewGuid() }, new OrderResponse { Id = Guid.NewGuid() } }));

        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.GetOrderAsync(filter);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        object payload = ok.Value!;
        int count = (int)payload.GetType().GetProperty("Count")!.GetValue(payload)!;
        IEnumerable<OrderResponse> orders = (IEnumerable<OrderResponse>)payload.GetType().GetProperty("Orders")!.GetValue(payload)!;

        Assert.Equal(2, count);
        Assert.Equal(2, orders.Count());
    }

    [Fact]
    public async Task GetByStateAsync_WhenServiceReturnsOrder_ShouldReturnOrder()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock
            .Setup(x => x.GetByStateAsync(OrderState.Placed, "order-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrderResponse { Id = Guid.NewGuid() });
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IOrderRequest? result = await controller.GetByStateAsync(OrderState.Placed, "order-1");

        Assert.NotNull(result);
        OrderResponse order = Assert.IsType<OrderResponse>(result);
        Assert.Equal(TestIds.Id("order-1"), order.Id);
    }

    [Fact]
    public async Task GetByStateAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock
            .Setup(x => x.GetByStateAsync(OrderState.Placed, "order-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync((IOrderRequest?)null);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IOrderRequest? result = await controller.GetByStateAsync(OrderState.Placed, "order-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPharmacyOrderAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IPharmacyOrderService> pharmacyServiceMock = new();
        pharmacyServiceMock
            .Setup(x => x.GetByOrderId("order-1", It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new PharmacyOrderResponse { Id = Guid.NewGuid() } }));
        OrderApiController controller = CreateController(pharmacyOrderServiceMock: pharmacyServiceMock);

        List<PharmacyOrderResponse> result = new();
        await foreach (PharmacyOrderResponse item in controller.GetPharmacyOrderAsync("order-1"))
            result.Add(item);

        Assert.Single(result);
        Assert.Equal(TestIds.Id("ph-1"), result[0].Id);
    }

    [Fact]
    public async Task ConsultingAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Order", "Invalid");

        IActionResult result = await controller.ConsultingAsync(new OrderConsultingRequest());

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.ConsultingAsync(It.IsAny<OrderConsultingRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConsultingAsync_WhenServiceReturnsTuple_ShouldReturnOkWithPayload()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderConsultingRequest dto = new() { OrderId = "order-2" };
        orderServiceMock
            .Setup(x => x.ConsultingAsync(dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "order-2"));
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.ConsultingAsync(dto);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        object payload = ok.Value!;
        bool requestResult = (bool)payload.GetType().GetProperty("Result")!.GetValue(payload)!;
        string orderId = (string)payload.GetType().GetProperty("orderId")!.GetValue(payload)!;

        Assert.False(requestResult);
        Assert.Equal("order-2", orderId);
    }

    [Fact]
    public async Task InSearchingAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderInSearchRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.InSearchingAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task InSearchingAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("InSearch", "Invalid");
        OrderInSearchRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.InSearchingAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.InSearchAsync(It.IsAny<string>(), It.IsAny<OrderInSearchRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InSearchingAsync_WhenServiceReturnsFalse_ShouldReturnOkWithFalse()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderInSearchRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.InSearchAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.InSearchingAsync("order-1", dto);

        Assert.False(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task WaitingClientAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderWaitClientRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.WaitingClientAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task WaitingClientAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Waiting", "Invalid");
        OrderWaitClientRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.WaitingClientAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.WaitingClientAsync(It.IsAny<string>(), It.IsAny<OrderWaitClientRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task WaitingClientAsync_WhenServiceReturnsTrue_ShouldReturnOkWithTrue()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderWaitClientRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.WaitingClientAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.WaitingClientAsync("order-1", dto);

        Assert.True(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task PlacementAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderPlacementRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.PlacementAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PlacementAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Placement", "Invalid");
        OrderPlacementRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.PlacementAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.PlacementAsync(It.IsAny<string>(), It.IsAny<OrderPlacementRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PlacementAsync_WhenServiceReturnsFalse_ShouldReturnOkWithFalse()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderPlacementRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.PlacementAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.PlacementAsync("order-1", dto);

        Assert.False(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task DeliveredAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderDeliveryRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.DeliveredAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeliveredAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Delivered", "Invalid");
        OrderDeliveryRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.DeliveredAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.DeliveryAsync(It.IsAny<string>(), It.IsAny<OrderDeliveryRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeliveredAsync_WhenServiceReturnsTrue_ShouldReturnOkWithTrue()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderDeliveryRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.DeliveryAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.DeliveredAsync("order-1", dto);

        Assert.True(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task CancellationAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderCancelRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.CancellationAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancellationAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Cancellation", "Invalid");
        OrderCancelRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.CancellationAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.CancellationAsync(It.IsAny<string>(), It.IsAny<OrderCancelRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CancellationAsync_WhenServiceReturnsFalse_ShouldReturnOkWithFalse()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderCancelRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.CancellationAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.CancellationAsync("order-1", dto);

        Assert.False(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task OrderRejectionAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderRejectionRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.OrderRejectionAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task OrderRejectionAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Rejection", "Invalid");
        OrderRejectionRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.OrderRejectionAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.OrderRejectionAsync(It.IsAny<string>(), It.IsAny<OrderRejectionRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OrderRejectionAsync_WhenServiceReturnsTrue_ShouldReturnOkWithTrue()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderRejectionRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.OrderRejectionAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.OrderRejectionAsync("order-1", dto);

        Assert.True(ExtractBooleanFromOk(result));
    }

    [Fact]
    public async Task OrderRejectionAsync_WhenReturnFromRejectionIsUndefined_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock
            .Setup(x => x.ReturnFromRejectionAsync(TestIds.Id("order-1"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(OrderState.Undefined);

        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.OrderRejectionAsync("order-1");

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task OrderRejectionAsync_WhenReturnFromRejectionIsSuccess_ShouldReturnOk()
    {
        Mock<IOrderService> orderServiceMock = new();
        orderServiceMock
            .Setup(x => x.ReturnFromRejectionAsync(TestIds.Id("order-1"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(OrderState.Placed);

        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.OrderRejectionAsync("order-1");

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(OrderState.Placed, ok.Value);
    }

    [Fact]
    public async Task ReturnAsync_WhenOrderIdMismatch_ShouldReturnBadRequest()
    {
        OrderApiController controller = CreateController();
        OrderReturnProductRequest dto = new() { OrderId = "body-id" };

        IActionResult result = await controller.ReturnAsync("route-id", dto);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ReturnAsync_WhenModelStateInvalid_ShouldReturnBadRequest()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);
        controller.ModelState.AddModelError("Return", "Invalid");
        OrderReturnProductRequest dto = new() { OrderId = "order-1" };

        IActionResult result = await controller.ReturnAsync("order-1", dto);

        Assert.IsType<BadRequestObjectResult>(result);
        orderServiceMock.Verify(x => x.ReturnAsync(It.IsAny<string>(), It.IsAny<OrderReturnProductRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ReturnAsync_WhenServiceReturnsFalse_ShouldReturnOkWithFalse()
    {
        Mock<IOrderService> orderServiceMock = new();
        OrderReturnProductRequest dto = new() { OrderId = "order-1" };
        orderServiceMock
            .Setup(x => x.ReturnAsync("order-1", dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        OrderApiController controller = CreateController(orderServiceMock: orderServiceMock);

        IActionResult result = await controller.ReturnAsync("order-1", dto);

        Assert.False(ExtractBooleanFromOk(result));
    }
}
