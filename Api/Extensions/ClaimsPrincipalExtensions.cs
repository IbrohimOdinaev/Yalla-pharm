using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Yalla.Domain.Enums;

namespace Api.Extensions;

internal static class ClaimsPrincipalExtensions
{
  public static Guid GetRequiredUserId(this ClaimsPrincipal user)
  {
    var userIdRaw = user.FindFirstValue(ClaimTypes.NameIdentifier)
      ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);

    if (!Guid.TryParse(userIdRaw, out var userId))
      throw new UnauthorizedAccessException("Invalid or missing user id claim.");

    return userId;
  }

  public static Role GetRequiredRole(this ClaimsPrincipal user)
  {
    var roleRaw = user.FindFirstValue(ClaimTypes.Role);
    if (!Enum.TryParse<Role>(roleRaw, out var role))
      throw new UnauthorizedAccessException("Invalid or missing role claim.");

    return role;
  }

  public static Guid GetRequiredPharmacyId(this ClaimsPrincipal user)
  {
    var pharmacyIdRaw = user.FindFirstValue("pharmacy_id");

    if (!Guid.TryParse(pharmacyIdRaw, out var pharmacyId))
      throw new UnauthorizedAccessException("Invalid or missing pharmacy_id claim.");

    return pharmacyId;
  }
}
