namespace Yalla.Application.DTO.Response;

public sealed class GetClientOrderHistoryResponse
{
  public Guid ClientId { get; init; }
  public IReadOnlyCollection<OrderHistoryItemResponse> Orders { get; init; } = [];
}
