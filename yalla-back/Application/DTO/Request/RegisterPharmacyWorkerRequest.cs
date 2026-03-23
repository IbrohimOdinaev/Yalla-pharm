namespace Yalla.Application.DTO.Request;

public sealed class RegisterPharmacyWorkerRequest
{
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public string Password { get; init; } = string.Empty;
  public Guid PharmacyId { get; init; }
}
