namespace Yalla.Presentation.Tests.Controllers;

public sealed class PackagingTypeApiControllerTests
{
    [Fact]
    public void Ctor_WhenServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new PackagingTypeApiController(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        PackagingTypeResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        PackagingTypeResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        PackagingTypeResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        PackagingTypeResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync("type-3", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync("type-3");

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync("type-3", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PackagingTypeApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync("type-3");

        Assert.False(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsItem_ShouldReturnItem()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync("type-4", It.IsAny<CancellationToken>())).ReturnsAsync(new PackagingTypeResponse { Id = Guid.NewGuid() });
        PackagingTypeApiController controller = new(serviceMock.Object);

        PackagingTypeResponse? result = await controller.GetAsync("type-4");

        Assert.NotNull(result);
        Assert.Equal("type-4", result!.Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync("type-4", It.IsAny<CancellationToken>())).ReturnsAsync((PackagingTypeResponse?)null);
        PackagingTypeApiController controller = new(serviceMock.Object);

        PackagingTypeResponse? result = await controller.GetAsync("type-4");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new PackagingTypeResponse { Id = Guid.NewGuid() } }));
        PackagingTypeApiController controller = new(serviceMock.Object);

        List<PackagingTypeResponse> result = new();
        await foreach (PackagingTypeResponse item in controller.GetAsync())
            result.Add(item);

        Assert.Single(result);
        Assert.Equal("type-5", result[0].Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsEmpty_ShouldReturnEmpty()
    {
        Mock<IPackagingTypeService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<PackagingTypeResponse>()));
        PackagingTypeApiController controller = new(serviceMock.Object);

        List<PackagingTypeResponse> result = new();
        await foreach (PackagingTypeResponse item in controller.GetAsync())
            result.Add(item);

        Assert.Empty(result);
    }
}
