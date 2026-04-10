namespace Yalla.Application.DTO.Response;

public sealed class StartTelegramAuthResponse
{
  public string Nonce { get; init; } = string.Empty;
  public string DeepLink { get; init; } = string.Empty;
  public string BotUsername { get; init; } = string.Empty;
  public DateTime ExpiresAtUtc { get; init; }
  public int TtlSeconds { get; init; }
}
