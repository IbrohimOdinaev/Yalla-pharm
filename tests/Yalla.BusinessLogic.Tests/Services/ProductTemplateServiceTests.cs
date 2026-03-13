using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class ProductTemplateServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new ProductTemplateService(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldCallRepository()
    {
        Mock<IProductTemplateRepository> repositoryMock = new();
        ProductTemplateResponse entity = TestDataFactory.CreateProductTemplateDto();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbProductTemplate>(), cancellationToken))
            .ReturnsAsync(true);

        ProductTemplateService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(entity, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(It.IsAny<DbProductTemplate>(), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetAsync_WhenRepositoryReturnsNull_ShouldReturnNull()
    {
        Mock<IProductTemplateRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.GetAsync("id", cancellationToken))
            .ReturnsAsync((DbProductTemplate?)null);

        ProductTemplateService service = new(repositoryMock.Object);

        ProductTemplateResponse? result = await service.GetAsync("id", cancellationToken);

        Assert.Null(result);
        repositoryMock.Verify(x => x.GetAsync("id", cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
