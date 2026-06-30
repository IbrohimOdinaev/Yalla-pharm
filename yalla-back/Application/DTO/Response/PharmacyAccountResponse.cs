namespace Yalla.Application.DTO.Response;

public sealed class PharmacyAccountResponse
{
  public Guid Id { get; init; }
  public Guid PharmacyId { get; init; }
  public string Login { get; init; } = string.Empty;
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public string? AvatarUrl { get; init; }
  public bool IsActive { get; init; }
}

public sealed class GetPharmacyAccountsResponse
{
  public IReadOnlyCollection<PharmacyAccountResponse> Accounts { get; init; } = [];
}

public sealed class ResetPharmacyAccountPasswordResponse
{
  public Guid PharmacyAccountId { get; init; }
  public Guid PharmacyId { get; init; }
  public string Login { get; init; } = string.Empty;
  public string NewPassword { get; init; } = string.Empty;
}
