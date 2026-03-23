namespace Yalla.Presentation.Tests.Controllers;

public sealed class ClientApiControllerTests
{
    [Fact]
    public void Ctor_WhenServiceIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new ClientApiController(null!));
    }

    [Fact]
    public async Task CreateClientAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IClientService> serviceMock = new();
        ClientResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateClientAsync(dto);

        Assert.True(result);
        serviceMock.Verify(x => x.CreateAsync(dto, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateClientAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IClientService> serviceMock = new();
        ClientResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.CreateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.CreateClientAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task UpdateClientAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IClientService> serviceMock = new();
        ClientResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateClientAsync(dto);

        Assert.True(result);
    }

    [Fact]
    public async Task UpdateClientAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IClientService> serviceMock = new();
        ClientResponse dto = new() { Id = Guid.NewGuid() };
        serviceMock.Setup(x => x.UpdateAsync(dto, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.UpdateClientAsync(dto);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteClientAsync_WhenServiceReturnsTrue_ShouldReturnTrue()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("client-3"), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteClientAsync(TestIds.Id("client-3"));

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteClientAsync_WhenServiceReturnsFalse_ShouldReturnFalse()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock.Setup(x => x.DeleteAsync(TestIds.Id("client-3"), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        ClientApiController controller = new(serviceMock.Object);

        bool result = await controller.DeleteClientAsync(TestIds.Id("client-3"));

        Assert.False(result);
    }

    [Fact]
    public async Task GetClientByIdAsync_WhenServiceReturnsClient_ShouldReturnClient()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("client-4"), It.IsAny<CancellationToken>())).ReturnsAsync(new ClientResponse { Id = TestIds.Id("client-4") });
        ClientApiController controller = new(serviceMock.Object);

        ClientResponse? result = await controller.GetClientByIdAsync(TestIds.Id("client-4"));

        Assert.NotNull(result);
        Assert.Equal(TestIds.Id("client-4"), result!.Id);
    }

    [Fact]
    public async Task GetClientByIdAsync_WhenServiceReturnsNull_ShouldReturnNull()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock.Setup(x => x.GetAsync(TestIds.Id("client-4"), It.IsAny<CancellationToken>())).ReturnsAsync((ClientResponse?)null);
        ClientApiController controller = new(serviceMock.Object);

        ClientResponse? result = await controller.GetClientByIdAsync(TestIds.Id("client-4"));

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAllClientAsync_WhenServiceReturnsItems_ShouldReturnItems()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(new[] { new ClientResponse { Id = TestIds.Id("client-1") } }));

        ClientApiController controller = new(serviceMock.Object);

        List<ClientResponse> result = new();
        await foreach (ClientResponse item in controller.GetAllClientAsync())
            result.Add(item);

        Assert.Single(result);
        Assert.Equal(TestIds.Id("client-1"), result[0].Id);
    }

    [Fact]
    public async Task GetAllClientAsync_WhenServiceReturnsEmpty_ShouldReturnEmpty()
    {
        Mock<IClientService> serviceMock = new();
        serviceMock
            .Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<ClientResponse>()));

        ClientApiController controller = new(serviceMock.Object);

        List<ClientResponse> result = new();
        await foreach (ClientResponse item in controller.GetAllClientAsync())
            result.Add(item);

        Assert.Empty(result);
    }
}
