using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Api.Hubs;

[Authorize]
public sealed class UpdatesHub : Hub
{
  public const string SuperAdminGroup = "role:SuperAdmin";

  public override async Task OnConnectedAsync()
  {
    var role = Context.User?.FindFirstValue(ClaimTypes.Role);
    if (string.Equals(role, "SuperAdmin", StringComparison.Ordinal))
    {
      await Groups.AddToGroupAsync(Context.ConnectionId, SuperAdminGroup);
    }

    await base.OnConnectedAsync();
  }
}
