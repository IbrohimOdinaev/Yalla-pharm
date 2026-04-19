namespace Yalla.Application.DTO.Response;

public sealed class ClientResponse
{
  public Guid Id { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public int? Gender { get; init; }
  public string? DateOfBirth { get; init; }
  public long? TelegramId { get; init; }
  public string? TelegramUsername { get; init; }
  public IReadOnlyCollection<BasketPositionResponse> BasketPositions { get; init; } = [];
  public IReadOnlyCollection<ClientOrderResponse> Orders { get; init; } = [];
  public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; init; } = [];
}
