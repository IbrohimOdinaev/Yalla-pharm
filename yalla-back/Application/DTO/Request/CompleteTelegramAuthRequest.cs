namespace Yalla.Application.DTO.Request;

public sealed class CompleteTelegramAuthRequest
{
  public string Nonce { get; init; } = string.Empty;
}
