namespace Yalla.Application.DTO.Request;

public sealed class RegisterAdminWithPharmacyRequest
{
  public string AdminName { get; init; } = string.Empty;
  public string AdminPhoneNumber { get; init; } = string.Empty;
  public string AdminPassword { get; init; } = string.Empty;
  public string PharmacyTitle { get; init; } = string.Empty;
  public string PharmacyAddress { get; init; } = string.Empty;
  public bool IsPharmacyActive { get; init; } = true;
}
