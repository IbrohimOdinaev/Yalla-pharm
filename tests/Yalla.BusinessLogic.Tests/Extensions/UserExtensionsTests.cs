using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Extensions;

public sealed class UserExtensionsTests
{
    [Fact]
    public void Should_MapAllFields_When_ConvertingDbUserToUserDto()
    {
        DbUser dbUser = TestDataFactory.CreateDbUser(UserRole.Administrator) with
        {
            Id = Guid.NewGuid(),
            FirstName = "First",
            LastName = "Last",
            PhoneNumber = "+992900001234",
            Email = "db.user@yalla.test",
            Password = "db-password-1",
        };

        UserResponse userDto = dbUser.UserToDto();

        Assert.Equal(dbUser.Id, userDto.Id);
        Assert.Equal(dbUser.FirstName, userDto.FirstName);
        Assert.Equal(dbUser.LastName, userDto.LastName);
        Assert.Equal(dbUser.PhoneNumber, userDto.PhoneNumber);
        Assert.Equal(dbUser.Email, userDto.Email);
        Assert.Equal(dbUser.Password, userDto.Password);
        Assert.Equal(dbUser.Role, userDto.Role);
    }

    [Fact]
    public void Should_MapAllFields_When_ConvertingUserDtoToDbUser()
    {
        UserResponse userDto = TestDataFactory.CreateUserDto(UserRole.Operator) with
        {
            Id = Guid.NewGuid(),
            FirstName = "Operator",
            LastName = "User",
            PhoneNumber = "+992900005555",
            Email = "dto.user@yalla.test",
            Password = "dto-password-1",
        };

        DbUser dbUser = userDto.DtoToUser();

        Assert.Equal(userDto.Id, dbUser.Id);
        Assert.Equal(userDto.FirstName, dbUser.FirstName);
        Assert.Equal(userDto.LastName, dbUser.LastName);
        Assert.Equal(userDto.PhoneNumber, dbUser.PhoneNumber);
        Assert.Equal(userDto.Email, dbUser.Email);
        Assert.Equal(userDto.Password, dbUser.Password);
        Assert.Equal(userDto.Role, dbUser.Role);
    }
}
