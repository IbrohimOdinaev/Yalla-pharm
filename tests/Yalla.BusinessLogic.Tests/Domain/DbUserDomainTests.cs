namespace Yalla.BusinessLogic.Tests.Domain;

public sealed class DbUserDomainTests
{
    [Fact]
    public void Should_GenerateNewId_When_IdIsEmpty()
    {
        DbUser user = CreateValidUser(id: string.Empty);

        Assert.False(string.IsNullOrWhiteSpace(user.Id));
    }

    [Fact]
    public void Should_KeepProvidedId_When_IdIsSpecified()
    {
        DbUser user = CreateValidUser(id: "user-domain-1");

        Assert.Equal("user-domain-1", user.Id);
    }

    [Theory]
    [InlineData("")]
    public void Should_ThrowArgumentOutOfRangeException_When_FirstNameIsInvalid(string firstName)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateValidUser(firstName: firstName));
    }

    [Theory]
    [InlineData("")]
    public void Should_ThrowArgumentOutOfRangeException_When_LastNameIsInvalid(string lastName)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateValidUser(lastName: lastName));
    }

    [Theory]
    [InlineData("")]
    public void Should_ThrowArgumentOutOfRangeException_When_PhoneNumberIsInvalid(string phoneNumber)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateValidUser(phoneNumber: phoneNumber));
    }

    [Theory]
    [InlineData("")]
    public void Should_ThrowArgumentOutOfRangeException_When_EmailIsInvalid(string email)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateValidUser(email: email));
    }

    [Theory]
    [InlineData("")]
    public void Should_ThrowArgumentOutOfRangeException_When_PasswordIsInvalid(string password)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateValidUser(password: password));
    }

    [Fact]
    public void Should_CreateUser_When_AllRequiredFieldsAreValid()
    {
        DbUser user = CreateValidUser();

        Assert.Equal("user-domain-valid", user.Id);
        Assert.Equal("Domain", user.FirstName);
        Assert.Equal("Tester", user.LastName);
        Assert.Equal("+992900007777", user.PhoneNumber);
        Assert.Equal("domain.tester@yalla.test", user.Email);
        Assert.Equal("password-123", user.Password);
        Assert.Equal(UserRole.Operator, user.Role);
    }

    private static DbUser CreateValidUser(
        string id = "user-domain-valid",
        string firstName = "Domain",
        string lastName = "Tester",
        string phoneNumber = "+992900007777",
        string email = "domain.tester@yalla.test",
        string password = "password-123") => new()
        {
            Id = id,
            FirstName = firstName,
            LastName = lastName,
            PhoneNumber = phoneNumber,
            Email = email,
            Password = password,
            Role = UserRole.Operator,
        };
}
