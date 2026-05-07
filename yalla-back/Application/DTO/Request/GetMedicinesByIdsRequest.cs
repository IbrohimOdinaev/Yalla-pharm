namespace Yalla.Application.DTO.Request;

/// <summary>
/// Batch lookup of medicines by id. Used by callers (pharmacist cart,
/// prescription detail) that have a known set of medicine ids and would
/// otherwise fan out N+1 GET requests over HTTP. Up to 200 ids per call —
/// anything larger is paginated by the caller.
/// </summary>
public sealed class GetMedicinesByIdsRequest
{
  public const int MaxIdsPerRequest = 200;

  public IReadOnlyList<Guid> Ids { get; init; } = Array.Empty<Guid>();
}
