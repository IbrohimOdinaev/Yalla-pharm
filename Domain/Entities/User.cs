using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public abstract class User
{
  public Guid Id { get; private protected set; }

  public string Name { get; private protected set; } = string.Empty;

  public string PhoneNumber { get; private protected set; } = string.Empty;

  private protected User() { }
  public User(string name, string phoneNumber)
  {
    if (string.IsNullOrWhiteSpace(name))
      throw new DomainArgumentException("User.Name can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(phoneNumber))
      throw new DomainArgumentException("User.PhoneNumber can't be null or whitespace.");

    if (!phoneNumber.All(char.IsDigit))
      throw new DomainArgumentException("User.PhoneNumber must contain digits only.");

    Name = name;
    PhoneNumber = phoneNumber;
  }

  public void SetName(string name)
  {
    if (string.IsNullOrWhiteSpace(name))
      throw new DomainArgumentException("User.Name can't be null or whitespace.");

    Name = name;
  }

  public void SetPhoneNumber(string phoneNumber)
  {
    if (string.IsNullOrWhiteSpace(phoneNumber))
      throw new DomainArgumentException("User.PhoneNumber can't be null or whitespace.");

    if (!phoneNumber.All(char.IsDigit))
      throw new DomainArgumentException("User.PhoneNumber must contain digits only.");

    PhoneNumber = phoneNumber;
  }

}
