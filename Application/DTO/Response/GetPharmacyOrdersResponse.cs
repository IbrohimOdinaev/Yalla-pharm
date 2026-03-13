using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class GetPharmacyOrdersResponse
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public Status? Status { get; init; }
  public int Page { get; init; }
  public int PageSize { get; init; }
  public int TotalCount { get; init; }
  public IReadOnlyCollection<WorkerOrderResponse> Orders { get; init; } = [];
}
