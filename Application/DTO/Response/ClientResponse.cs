namespace Yalla.Application.DTO.Response;

public sealed class ClientResponse
{
  public Guid Id { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public IReadOnlyCollection<BasketPositionResponse> BasketPositions { get; init; } = [];
  public IReadOnlyCollection<ClientOrderResponse> Orders { get; init; } = [];
  public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
}
