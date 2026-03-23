using Yalla.Domain.Enums;

namespace Yalla.Application.Abstractions;

public interface IJwtTokenProvider
{
  (string AccessToken, DateTime ExpiresAtUtc) GenerateToken(
    Guid userId,
    string name,
    string phoneNumber,
    Role role,
    Guid? pharmacyId = null);
}
