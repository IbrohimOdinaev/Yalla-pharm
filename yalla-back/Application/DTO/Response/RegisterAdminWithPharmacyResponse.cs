namespace Yalla.Application.DTO.Response;

public sealed class RegisterAdminWithPharmacyResponse
{
  public PharmacyWorkerResponse PharmacyWorker { get; init; } = new();
  public PharmacyResponse Pharmacy { get; init; } = new();
}
