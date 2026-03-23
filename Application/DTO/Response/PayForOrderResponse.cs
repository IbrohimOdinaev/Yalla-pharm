namespace Yalla.Application.DTO.Response;

public sealed class PayForOrderResponse
{
  public bool IsPaid { get; init; }
  public string Provider { get; init; } = string.Empty;
  public string Status { get; init; } = string.Empty;
  public string? TransactionId { get; init; }
  public string? PaymentUrl { get; init; }
  public string? PaymentComment { get; init; }
  public string? ReceiverAccount { get; init; }
  public string? FailureReason { get; init; }
}
