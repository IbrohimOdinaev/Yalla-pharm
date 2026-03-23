using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class PharmacyOrderServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new PharmacyOrderService(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldCallRepository()
    {
        Mock<IPharmacyOrderRepository> repositoryMock = new();
        PharmacyOrderResponse entity = TestDataFactory.CreatePharmacyOrderDto();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbPharmacyOrder>(), cancellationToken))
            .ReturnsAsync(true);

        PharmacyOrderService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(entity, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(It.IsAny<DbPharmacyOrder>(), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetByOrderId_WhenRepositoryReturnsItems_ShouldReturnMappedDtos()
    {
        Mock<IPharmacyOrderRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        List<DbPharmacyOrder> pharmacyOrders = new() { TestDataFactory.CreateDbPharmacyOrder() };

        repositoryMock
            .Setup(x => x.GetByOrderId("order-1", cancellationToken))
            .Returns(pharmacyOrders.ToAsyncEnumerable());

        PharmacyOrderService service = new(repositoryMock.Object);

        List<PharmacyOrderResponse> result = await service.GetByOrderId("order-1", cancellationToken).ToListAsync(cancellationToken);

        Assert.Single(result);
        Assert.Equal("pharmacy-order-1", result[0].Id);
        repositoryMock.Verify(x => x.GetByOrderId("order-1", cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
