using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class OrderHistoryServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new OrderHistoryService(null!));
    }

    [Fact]
    public async Task UpdateOrderStateAsync_WhenUpdateStateIsNull_ShouldThrowArgumentNullException()
    {
        OrderHistoryService service = new(new Mock<IOrderHistoryRepository>().Object);

        await Assert.ThrowsAsync<ArgumentNullException>(() => service.UpdateOrderStateAsync(null!, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateOrderStateAsync_WhenOrderHistoryNotFound_ShouldReturnFalse()
    {
        Mock<IOrderHistoryRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        UpdateOrderStateRequest updateState = TestDataFactory.CreateUpdateStateDto();

        repositoryMock
            .Setup(x => x.GetByOrderIdAsync(updateState.OrderId.ToString(), cancellationToken))
            .ReturnsAsync((DbOrderHistory?)null);

        OrderHistoryService service = new(repositoryMock.Object);

        bool result = await service.UpdateOrderStateAsync(updateState, cancellationToken);

        Assert.False(result);
        repositoryMock.Verify(x => x.GetByOrderIdAsync(updateState.OrderId.ToString(), cancellationToken), Times.Once);
        repositoryMock.Verify(x => x.UpdateAsync(It.IsAny<DbOrderHistory>(), It.IsAny<CancellationToken>()), Times.Never);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task UpdateOrderStateAsync_WhenOrderHistoryExists_ShouldUpdateStateAndReason()
    {
        Mock<IOrderHistoryRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        UpdateOrderStateRequest updateState = TestDataFactory.CreateUpdateStateDto() with
        {
            State = OrderState.Delivered,
            ReasonForTheDelay = "Traffic",
        };
        DbOrderHistory existing = TestDataFactory.CreateDbOrderHistory(OrderState.Placed);

        repositoryMock
            .Setup(x => x.GetByOrderIdAsync(updateState.OrderId.ToString(), cancellationToken))
            .ReturnsAsync(existing);

        repositoryMock
            .Setup(x => x.UpdateAsync(It.IsAny<DbOrderHistory>(), cancellationToken))
            .ReturnsAsync(true);

        OrderHistoryService service = new(repositoryMock.Object);

        bool result = await service.UpdateOrderStateAsync(updateState, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.GetByOrderIdAsync(updateState.OrderId.ToString(), cancellationToken), Times.Once);
        repositoryMock.Verify(x => x.UpdateAsync(
            It.Is<DbOrderHistory>(history =>
                history.State == OrderState.Delivered
                && history.ReasonForOrderDelay == "Traffic"),
            cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
