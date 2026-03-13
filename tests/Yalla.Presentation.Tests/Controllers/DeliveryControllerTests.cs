namespace Yalla.Presentation.Tests.Controllers;

public sealed class DeliveryControllerTests
{
    [Fact]
    public void Ctor_WhenServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new DeliveryController(null!));
    }

    [Fact]
    public async Task SendAsync_WhenCalled_ShouldSendDefaultDeliveryRequest()
    {
        Mock<IDeliveryService> serviceMock = new();
        serviceMock.Setup(x => x.SendAsync(It.IsAny<DeliveryStatusRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        DeliveryController controller = new(serviceMock.Object);

        bool result = await controller.SendAsync();

        Assert.True(result);
        serviceMock.Verify(x => x.SendAsync(
            It.Is<DeliveryStatusRequest>(dto => dto.OrderDetails == "Hello from YallaCRM" && !string.IsNullOrEmpty(dto.OrderId)),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IDeliveryService> serviceMock = new();
        serviceMock.Setup(x => x.SendAsync(It.IsAny<DeliveryStatusRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        DeliveryController controller = new(serviceMock.Object);

        bool result = await controller.SendAsync();

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenCalled_ShouldPassDtoToService()
    {
        Mock<IDeliveryService> serviceMock = new();
        DeliveryStatusRequest request = new() { OrderId = "order-1", OrderDetails = "details" };
        serviceMock.Setup(x => x.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        DeliveryController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(request);

        Assert.True(result);
        serviceMock.Verify(x => x.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IDeliveryService> serviceMock = new();
        DeliveryStatusRequest request = new() { OrderId = "order-1", OrderDetails = "details" };
        serviceMock.Setup(x => x.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        DeliveryController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(request);

        Assert.False(result);
    }
}
