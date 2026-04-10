namespace Yalla.Application.DTO.Response;

public sealed class PollTelegramAuthResponse
{
  /// <summary>"pending" | "confirmed" | "cancelled" | "expired" | "consumed"</summary>
  public string Status { get; init; } = "pending";
}
