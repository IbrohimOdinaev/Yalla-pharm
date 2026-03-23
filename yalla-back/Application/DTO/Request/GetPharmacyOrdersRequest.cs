using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class GetPharmacyOrdersRequest
{
  public Guid WorkerId { get; init; }
  public Guid PharmacyId { get; init; }
  public Status? Status { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
