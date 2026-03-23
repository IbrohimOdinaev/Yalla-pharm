namespace Yalla.Presentation.Tests.Controllers;

public sealed class ProductTemplateApiControllerTests
{
    [Fact]
    public void Ctor_WhenTemplateServiceIsNull_ShouldThrowArgumentNullException()
    {
        Mock<IImageService> imageServiceMock = new();

        Assert.Throws<ArgumentNullException>(() => new ProductTemplateApiController(null!, imageServiceMock.Object));
    }

    [Fact]
    public void Ctor_WhenImageServiceIsNull_ShouldThrowArgumentNullException()
    {
        Mock<IProductTemplateService> templateServiceMock = new();

        Assert.Throws<ArgumentNullException>(() => new ProductTemplateApiController(templateServiceMock.Object, null!));
    }

    [Fact]
    public async Task CreateProductTemplateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        ProductTemplateResponse dto = new();
        templateServiceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.CreateProductTemplateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task CreateProductTemplateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        ProductTemplateResponse dto = new();
        templateServiceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.CreateProductTemplateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateProductTemplateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        ProductTemplateResponse dto = new();
        templateServiceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.UpdateProductTemplateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateProductTemplateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        ProductTemplateResponse dto = new();
        templateServiceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.UpdateProductTemplateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteProductTemplateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock.Setup(x => x.DeleteAsync(TestIds.Id("template-1"), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.DeleteProductTemplateAsync(TestIds.Id("template-1"));

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteProductTemplateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock.Setup(x => x.DeleteAsync(TestIds.Id("template-1"), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        bool result = await controller.DeleteProductTemplateAsync(TestIds.Id("template-1"));

        Assert.False(result);
    }

    [Fact]
    public async Task GetProductTemplateByIdAsync_WhenServiceReturnsTemplate_ShouldReturnTemplate()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock.Setup(x => x.GetAsync(TestIds.Id("template-2"), It.IsAny<CancellationToken>())).ReturnsAsync(new ProductTemplateResponse { Id = TestIds.Id("template-2") });

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        ProductTemplateResponse? result = await controller.GetProductTemplateByIdAsync(TestIds.Id("template-2"));

        Assert.NotNull(result);
        Assert.Equal(TestIds.Id("template-2"), result!.Id);
    }

    [Fact]
    public async Task GetProductTemplateByIdAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock.Setup(x => x.GetAsync(TestIds.Id("template-2"), It.IsAny<CancellationToken>())).ReturnsAsync((ProductTemplateResponse?)null);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        ProductTemplateResponse? result = await controller.GetProductTemplateByIdAsync(TestIds.Id("template-2"));

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAllProductTemplateAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new ProductTemplateResponse { Id = TestIds.Id("template-3") } }));

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        List<ProductTemplateResponse> result = new();
        await foreach (ProductTemplateResponse item in controller.GetAllProductTemplateAsync())
            result.Add(item);

        Assert.Single(result);
        Assert.Equal(TestIds.Id("template-3"), result[0].Id);
    }

    [Fact]
    public async Task GetAllProductTemplateAsync_WhenServiceReturnsEmpty_ShouldReturnEmpty()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        templateServiceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<ProductTemplateResponse>()));

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        List<ProductTemplateResponse> result = new();
        await foreach (ProductTemplateResponse item in controller.GetAllProductTemplateAsync())
            result.Add(item);

        Assert.Empty(result);
    }

    [Fact]
    public async Task SaveProductImage_WhenServiceReturnsPath_ShouldReturnPath()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        imageServiceMock.Setup(x => x.SaveImageAsync("image-base64", It.IsAny<CancellationToken>())).ReturnsAsync("/images/a.png");

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        string? result = await controller.SaveProductImage("image-base64");

        Assert.Equal("/images/a.png", result);
    }

    [Fact]
    public async Task SaveProductImage_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        Mock<IImageService> imageServiceMock = new();
        imageServiceMock.Setup(x => x.SaveImageAsync("image-base64", It.IsAny<CancellationToken>())).ReturnsAsync((string?)null);

        ProductTemplateApiController controller = new(templateServiceMock.Object, imageServiceMock.Object);

        string? result = await controller.SaveProductImage("image-base64");

        Assert.Null(result);
    }
}
