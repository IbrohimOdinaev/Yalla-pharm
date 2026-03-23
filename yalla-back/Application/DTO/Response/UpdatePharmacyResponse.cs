namespace Yalla.Application.DTO.Response;

public sealed class UpdatePharmacyResponse
{
  public PharmacyResponse Pharmacy { get; init; } = new();
}
