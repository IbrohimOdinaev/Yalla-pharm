using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class ClientServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new ClientService(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsNull_ShouldThrowArgumentNullException()
    {
        ClientService service = new(new Mock<IClientRepository>().Object);

        await Assert.ThrowsAsync<ArgumentNullException>(() => service.CreateAsync(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldCallRepository()
    {
        Mock<IClientRepository> repositoryMock = new();
        ClientResponse entity = TestDataFactory.CreateClientDto();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbClient>(), cancellationToken))
            .ReturnsAsync(true);

        ClientService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(entity, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(It.IsAny<DbClient>(), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SearchByQueryAsync_WhenRepositoryReturnsItems_ShouldReturnMappedDtos()
    {
        Mock<IClientRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        List<DbClient> clients = new() { TestDataFactory.CreateDbClient() };

        repositoryMock
            .Setup(x => x.SearchByQueryAsync("query", cancellationToken))
            .Returns(clients.ToAsyncEnumerable());

        ClientService service = new(repositoryMock.Object);

        List<ClientResponse> result = await service.SearchByQueryAsync("query", cancellationToken).ToListAsync(cancellationToken);

        Assert.Single(result);
        Assert.Equal("Test Client", result[0].FullName);
        repositoryMock.Verify(x => x.SearchByQueryAsync("query", cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
