namespace Yalla.Application.DTO.Request;

public sealed class RegisterPharmacyRequest
{
  public string Title { get; init; } = string.Empty;
  public string Address { get; init; } = string.Empty;
  public Guid AdminId { get; init; }
  public bool HasDelivery { get; init; }
  public string? OpensAt { get; init; }
  public string? ClosesAt { get; init; }
}
