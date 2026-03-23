namespace Yalla.Application.DTO.Response;

public sealed class RegisterPharmacyWorkerResponse
{
  public PharmacyWorkerResponse PharmacyWorker { get; init; } = new();
}
