namespace Yalla.Application.DTO.Response;

public sealed class RefundRequestStubResponse
{
  public Guid RefundRequestId { get; init; }
  public Guid OrderId { get; init; }
  public decimal Amount { get; init; }
  public DateTime CreatedAtUtc { get; init; }
  public string Status { get; init; } = "CreatedStub";
}
