namespace Yalla.Application.DTO.Request;

public sealed class CreateStaffPayoutRequestRequest
{
  public string? Bank { get; init; }
  public string WalletPhoneNumber { get; init; } = string.Empty;
}
