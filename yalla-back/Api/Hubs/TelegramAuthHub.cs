using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Api.Hubs;

/// <summary>
/// Anonymous SignalR hub used to push Telegram-auth status changes to the
/// browser that is currently waiting on the /login screen.
/// </summary>
[AllowAnonymous]
public sealed class TelegramAuthHub : Hub
{
  /// <summary>
  /// Frontend calls this immediately after receiving a nonce from POST /api/auth/telegram/start.
  /// We add the connection to a group named "tgauth:{nonce}".
  /// </summary>
  public async Task SubscribeAsync(string nonce)
  {
    if (string.IsNullOrWhiteSpace(nonce)) return;
    if (nonce.Length > 64) return;
    foreach (var ch in nonce)
    {
      if (!(char.IsLetterOrDigit(ch) || ch == '_' || ch == '-')) return;
    }
    await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(nonce));
  }

  public static string GroupName(string nonce) => $"tgauth:{nonce}";
}
