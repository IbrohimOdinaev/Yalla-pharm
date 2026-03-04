namespace Yalla.Application.DTO.Response;

public sealed class RegisterPharmacyResponse
{
  public PharmacyResponse Pharmacy { get; init; } = new();
}
