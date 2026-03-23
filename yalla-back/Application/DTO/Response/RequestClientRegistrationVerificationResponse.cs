namespace Yalla.Application.DTO.Response;

public sealed class RequestClientRegistrationVerificationResponse
{
  public Guid RegistrationId { get; init; }
  public string PhoneNumber { get; init; } = string.Empty;
  public DateTime ExpiresAtUtc { get; init; }
  public DateTime ResendAvailableAtUtc { get; init; }
  public int CodeLength { get; init; }
}
