using Yalla.BusinessLogic.Tests.TestInfrastructure;
using Yalla.Domain.Core.Exceptions;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class UserServiceTests
{
    [Fact]
    public void Ctor_WhenRepositoryIsNull_ShouldThrowArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new UserService(null!));
    }

    [Fact]
    public async Task DeleteAsync_WhenUserIsSuperAdmin_ShouldThrowAndDoNotDelete()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        Guid userId = Guid.NewGuid();

        repositoryMock
            .Setup(x => x.GetAsync(userId, cancellationToken))
            .ReturnsAsync(TestDataFactory.CreateDbUser(UserRole.SuperAdmin));

        UserService service = new(repositoryMock.Object);

        await Assert.ThrowsAsync<DomainValidationException>(() => service.DeleteAsync(userId, cancellationToken));

        repositoryMock.Verify(x => x.GetAsync(userId, cancellationToken), Times.Once);
        repositoryMock.Verify(x => x.DeleteAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DeleteAsync_WhenUserIsNotSuperAdmin_ShouldDeleteAndReturnResult()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        Guid userId = Guid.NewGuid();

        repositoryMock
            .Setup(x => x.GetAsync(userId, cancellationToken))
            .ReturnsAsync(TestDataFactory.CreateDbUser(UserRole.Operator));

        repositoryMock
            .Setup(x => x.DeleteAsync(userId, cancellationToken))
            .ReturnsAsync(true);

        UserService service = new(repositoryMock.Object);

        bool result = await service.DeleteAsync(userId, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.GetAsync(userId, cancellationToken), Times.Once);
        repositoryMock.Verify(x => x.DeleteAsync(userId, cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DeleteAsync_WhenUserNotFound_ShouldStillCallDeleteAndReturnResult()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        Guid userId = Guid.NewGuid();

        repositoryMock
            .Setup(x => x.GetAsync(userId, cancellationToken))
            .ReturnsAsync((DbUser?)null);

        repositoryMock
            .Setup(x => x.DeleteAsync(userId, cancellationToken))
            .ReturnsAsync(true);

        UserService service = new(repositoryMock.Object);

        bool result = await service.DeleteAsync(userId, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.GetAsync(userId, cancellationToken), Times.Once);
        repositoryMock.Verify(x => x.DeleteAsync(userId, cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateAsync_WhenEntityIsValid_ShouldMapDtoAndCallRepository()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        UserResponse user = TestDataFactory.CreateUserDto(UserRole.Administrator) with
        {
            Id = Guid.NewGuid(),
            FirstName = "Create",
            LastName = "User",
            PhoneNumber = "+992900000111",
            Email = "create.user@yalla.test",
            Password = "create-password",
        };

        repositoryMock
            .Setup(x => x.CreateAsync(It.IsAny<DbUser>(), cancellationToken))
            .ReturnsAsync(true);

        UserService service = new(repositoryMock.Object);

        bool result = await service.CreateAsync(user, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.CreateAsync(
            It.Is<DbUser>(dbUser =>
                dbUser.Id == user.Id
                && dbUser.FirstName == user.FirstName
                && dbUser.LastName == user.LastName
                && dbUser.PhoneNumber == user.PhoneNumber
                && dbUser.Email == user.Email
                && dbUser.Password == user.Password
                && dbUser.Role == user.Role),
            cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task UpdateAsync_WhenEntityIsValid_ShouldMapDtoAndCallRepository()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;
        UserResponse user = TestDataFactory.CreateUserDto(UserRole.Operator) with
        {
            Id = Guid.NewGuid(),
            FirstName = "Update",
            LastName = "User",
            PhoneNumber = "+992900000222",
            Email = "update.user@yalla.test",
            Password = "updated-password",
        };

        repositoryMock
            .Setup(x => x.UpdateAsync(It.IsAny<DbUser>(), cancellationToken))
            .ReturnsAsync(true);

        UserService service = new(repositoryMock.Object);

        bool result = await service.UpdateAsync(user, cancellationToken);

        Assert.True(result);
        repositoryMock.Verify(x => x.UpdateAsync(
            It.Is<DbUser>(dbUser =>
                dbUser.Id == user.Id
                && dbUser.FirstName == user.FirstName
                && dbUser.LastName == user.LastName
                && dbUser.PhoneNumber == user.PhoneNumber
                && dbUser.Email == user.Email
                && dbUser.Password == user.Password
                && dbUser.Role == user.Role),
            cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetAsync_WhenCredentialsAreValid_ShouldReturnMappedUser()
    {
        Mock<IUserRepository> repositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        repositoryMock
            .Setup(x => x.GetAsync("user@yalla.test", "secret", cancellationToken))
            .ReturnsAsync(TestDataFactory.CreateDbUser(UserRole.Operator));

        UserService service = new(repositoryMock.Object);

        UserResponse? result = await service.GetAsync("user@yalla.test", "secret", cancellationToken);

        Assert.NotNull(result);
        Assert.Equal("user@yalla.test", result!.Email);
        repositoryMock.Verify(x => x.GetAsync("user@yalla.test", "secret", cancellationToken), Times.Once);
        repositoryMock.VerifyNoOtherCalls();
    }
}
