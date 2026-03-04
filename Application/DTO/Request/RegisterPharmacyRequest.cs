namespace Yalla.Application.DTO.Request;

public sealed class RegisterPharmacyRequest
{
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public Guid AdminId { get; init; }
}
