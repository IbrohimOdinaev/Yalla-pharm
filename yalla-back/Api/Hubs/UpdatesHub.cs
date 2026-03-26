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

    // Add admin to pharmacy group
    var pharmacyId = Context.User?.FindFirst("pharmacy_id")?.Value;
    if (!string.IsNullOrEmpty(pharmacyId))
      await Groups.AddToGroupAsync(Context.ConnectionId, $"pharmacy:{pharmacyId}");

    await base.OnConnectedAsync();
  }
}
