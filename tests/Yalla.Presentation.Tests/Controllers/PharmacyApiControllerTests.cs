namespace Yalla.Presentation.Tests.Controllers;

public sealed class PharmacyApiControllerTests
{
    [Fact]
    public void Ctor_WhenServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new PharmacyApiController(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPharmacyService> serviceMock = new();
        PharmacyResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task CreateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPharmacyService> serviceMock = new();
        PharmacyResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPharmacyService> serviceMock = new();
        PharmacyResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPharmacyService> serviceMock = new();
        PharmacyResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("pharmacy-1"), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync(TestIds.Id("pharmacy-1"));

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("pharmacy-1"), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        PharmacyApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteAsync(TestIds.Id("pharmacy-1"));

        Assert.False(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsPharmacy_ShouldReturnPharmacy()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("pharmacy-3"), It.IsAny<CancellationToken>())).ReturnsAsync(new PharmacyResponse { Id = TestIds.Id("pharmacy-3") });
        PharmacyApiController controller = new(serviceMock.Object);

        PharmacyResponse? result = await controller.GetAsync(TestIds.Id("pharmacy-3"));

        Assert.NotNull(result);
        Assert.Equal(TestIds.Id("pharmacy-3"), result!.Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("pharmacy-3"), It.IsAny<CancellationToken>())).ReturnsAsync((PharmacyResponse?)null);
        PharmacyApiController controller = new(serviceMock.Object);

        PharmacyResponse? result = await controller.GetAsync(TestIds.Id("pharmacy-3"));

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new PharmacyResponse { Id = TestIds.Id("pharmacy-4") } }));
        PharmacyApiController controller = new(serviceMock.Object);

        List<PharmacyResponse> result = new();
        await foreach (PharmacyResponse pharmacy in controller.GetAsync())
            result.Add(pharmacy);

        Assert.Single(result);
        Assert.Equal(TestIds.Id("pharmacy-4"), result[0].Id);
    }

    [Fact]
    public async Task GetAsync_WhenServiceReturnsEmpty_ShouldReturnEmpty()
    {
        Mock<IPharmacyService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<PharmacyResponse>()));
        PharmacyApiController controller = new(serviceMock.Object);

        List<PharmacyResponse> result = new();
        await foreach (PharmacyResponse pharmacy in controller.GetAsync())
            result.Add(pharmacy);

        Assert.Empty(result);
    }
}
