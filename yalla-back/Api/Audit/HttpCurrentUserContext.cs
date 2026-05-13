using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Api.Middleware;
using Yalla.Application.Abstractions;
using Yalla.Domain.Enums;

namespace Api.Audit;

/// <summary>
/// HttpContext-backed implementation of <see cref="ICurrentUserContext"/>.
/// Pulls the authenticated user's id/role from claims, the IP from the
/// connection (falling back to <c>X-Forwarded-For</c> first hop for
/// proxied deployments) and the correlation id stamped by
/// <see cref="CorrelationIdMiddleware"/>.
///
/// All properties return null when the request is anonymous or running
/// outside an HTTP context (background hosted services don't have one).
/// </summary>
public sealed class HttpCurrentUserContext : ICurrentUserContext
{
  private readonly IHttpContextAccessor _accessor;

  public HttpCurrentUserContext(IHttpContextAccessor accessor)
  {
    _accessor = accessor;
  }

  public Guid? UserId
  {
    get
    {
      var user = _accessor.HttpContext?.User;
      if (user?.Identity?.IsAuthenticated != true) return null;

      var raw = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);
      return Guid.TryParse(raw, out var id) ? id : null;
    }
  }

  public Role? Role
  {
    get
    {
      var user = _accessor.HttpContext?.User;
      if (user?.Identity?.IsAuthenticated != true) return null;
      var raw = user.FindFirstValue(ClaimTypes.Role);
      return Enum.TryParse<Role>(raw, out var role) ? role : null;
    }
  }

  public string? Ip
  {
    get
    {
      var http = _accessor.HttpContext;
      if (http is null) return null;

      var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
      if (!string.IsNullOrWhiteSpace(forwarded))
      {
        var firstHop = forwarded.Split(',', 2, StringSplitOptions.RemoveEmptyEntries)[0].Trim();
        if (firstHop.Length > 0) return firstHop;
      }

      return http.Connection.RemoteIpAddress?.ToString();
    }
  }

  public Guid? CorrelationId
  {
    get
    {
      var http = _accessor.HttpContext;
      if (http is null) return null;
      if (http.Items.TryGetValue(CorrelationIdMiddleware.ItemsKey, out var raw) && raw is Guid id)
        return id;
      return null;
    }
  }
}
