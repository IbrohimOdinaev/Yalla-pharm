using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class IntegrationSource
{
  public Guid Id { get; private set; }
  public Guid PharmacyId { get; private set; }
  public string Type { get; private set; } = string.Empty;
  public string Token { get; private set; } = string.Empty;
  public string Name { get; private set; } = string.Empty;
  public bool IsActive { get; private set; } = true;
  public DateTime CreatedAtUtc { get; private set; }

  private IntegrationSource() { }

  public IntegrationSource(Guid pharmacyId, string type, string token, string name, DateTime createdAtUtc)
  {
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("IntegrationSource.PharmacyId can't be empty.");

    if (string.IsNullOrWhiteSpace(type))
      throw new DomainArgumentException("IntegrationSource.Type can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(token))
      throw new DomainArgumentException("IntegrationSource.Token can't be null or whitespace.");

    Id = Guid.NewGuid();
    PharmacyId = pharmacyId;
    Type = type.Trim().ToLowerInvariant();
    Token = token.Trim();
    Name = string.IsNullOrWhiteSpace(name) ? Token : name.Trim();
    CreatedAtUtc = createdAtUtc;
    IsActive = true;
  }

  public void SetName(string name)
  {
    Name = string.IsNullOrWhiteSpace(name) ? Token : name.Trim();
  }

  public void SetIsActive(bool isActive)
  {
    IsActive = isActive;
  }
}
