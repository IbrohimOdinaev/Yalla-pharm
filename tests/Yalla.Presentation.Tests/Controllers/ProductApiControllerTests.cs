namespace Yalla.Presentation.Tests.Controllers;

public sealed class ProductApiControllerTests
{
    [Fact]
    public void Ctor_WhenServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new ProductApiController(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductService> serviceMock = new();
        ProductResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.True(result);
        serviceMock.Verify(x => x.CreateAsync(dto, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductService> serviceMock = new();
        ProductResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductService> serviceMock = new();
        ProductResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductService> serviceMock = new();
        ProductResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("product-3"), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync(TestIds.Id("product-3"));

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("product-3"), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ProductApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync(TestIds.Id("product-3"));

        Assert.False(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsProduct_ShouldReturnProduct()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("product-1"), It.IsAny<CancellationToken>())).ReturnsAsync(new ProductResponse { Id = TestIds.Id("product-1") });
        ProductApiController controller = new(serviceMock.Object);

        ProductResponse? result = await controller.GetAsync(TestIds.Id("product-1"));

        Assert.NotNull(result);
        Assert.Equal(TestIds.Id("product-1"), result!.Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("product-1"), It.IsAny<CancellationToken>())).ReturnsAsync((ProductResponse?)null);
        ProductApiController controller = new(serviceMock.Object);

        ProductResponse? result = await controller.GetAsync(TestIds.Id("product-1"));

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new ProductResponse { Id = TestIds.Id("product-4") } }));
        ProductApiController controller = new(serviceMock.Object);

        List<ProductResponse> result = new();
        await foreach (ProductResponse product in controller.GetAsync())
            result.Add(product);

        Assert.Single(result);
        Assert.Equal(TestIds.Id("product-4"), result[0].Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsEmpty_ShouldReturnEmpty()
    {
        Mock<IProductService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<ProductResponse>()));
        ProductApiController controller = new(serviceMock.Object);

        List<ProductResponse> result = new();
        await foreach (ProductResponse product in controller.GetAsync())
            result.Add(product);

        Assert.Empty(result);
    }
}
