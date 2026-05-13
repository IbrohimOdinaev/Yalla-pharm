namespace Yalla.Application.DTO.Response;

public sealed class PendingRefundResponse
{
  public Guid Id { get; init; }
  public Guid ClientId { get; init; }
  public Guid PrescriptionId { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string Reason { get; init; } = string.Empty;
  public DateTime CreatedAtUtc { get; init; }
  public DateTime? ProcessedAtUtc { get; init; }
  public Guid? ProcessedByUserId { get; init; }
  public string? SuperAdminComment { get; init; }
}
