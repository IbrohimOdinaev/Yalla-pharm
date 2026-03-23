namespace Yalla.Application.DTO.Response;

public sealed class GetRefundRequestsResponse
{
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<RefundRequestResponse> RefundRequests { get; init; } = [];
}
