using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class ProductHistoryServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new ProductHistoryService(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldCallRepository()
    {
        Mock<IProductHistoryRepository> repositoryMock = new();
        ProductHistoryResponse entity = TestDataFactory.CreateProductHistoryDto();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbProductHistory>(), cancellationToken))
            .ReturnsAsync(true);

        ProductHistoryService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(entity, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(It.IsAny<DbProductHistory>(), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public void GetCountProduct_WhenCalled_ShouldReturnRepositoryValue()
    {
        Mock<IProductHistoryRepository> repositoryMock = new();
        repositoryMock.Setup(x => x.GetCountProduct("product-1")).Returns(7);
        ProductHistoryService service = new(repositoryMock.Object);

        int result = service.GetCountProduct("product-1");

        Assert.Equal(7, result);
        repositoryMock.Verify(x => x.GetCountProduct("product-1"), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
