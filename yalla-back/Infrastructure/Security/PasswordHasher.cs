using Yalla.Application.Abstractions;
using Yalla.Domain.Exceptions;

namespace Yalla.Infrastructure.Security;

public sealed class PasswordHasher : IPasswordHasher
{
  public string HashPassword(string password)
  {
    if (string.IsNullOrWhiteSpace(password))
      throw new DomainArgumentException("Password can't be null or whitespace.");

    return BCrypt.Net.BCrypt.HashPassword(password);
  }

  public bool VerifyPassword(string password, string passwordHash)
  {
    if (string.IsNullOrWhiteSpace(password))
      throw new DomainArgumentException("Password can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(passwordHash))
      throw new DomainArgumentException("PasswordHash can't be null or whitespace.");

    return BCrypt.Net.BCrypt.Verify(password, passwordHash);
  }
}
