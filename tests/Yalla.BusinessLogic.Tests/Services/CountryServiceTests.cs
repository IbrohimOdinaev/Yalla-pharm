using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class CountryServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new CountryService(null!));
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldCallRepository()
    {
        Mock<ICountryRepository> repositoryMock = new();
        CountryResponse entity = TestDataFactory.CreateCountryDto();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbCountry>(), cancellationToken))
            .ReturnsAsync(true);

        CountryService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(entity, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(It.IsAny<DbCountry>(), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetAsync_WhenRepositoryReturnsNull_ShouldReturnNull()
    {
        Mock<ICountryRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.GetAsync(TestIds.Id("id"), cancellationToken))
            .ReturnsAsync((DbCountry?)null);

        CountryService service = new(repositoryMock.Object);

        CountryResponse? result = await service.GetAsync(TestIds.Id("id"), cancellationToken);

        Assert.Null(result);
        repositoryMock.Verify(x => x.GetAsync(TestIds.Id("id"), cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
