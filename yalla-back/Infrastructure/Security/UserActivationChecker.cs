using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Yalla.Application.Abstractions;
using Yalla.Application.Services;

namespace Yalla.Infrastructure.Security;

/// <summary>
/// IMemoryCache-backed implementation of
/// <see cref="IUserActivationChecker"/>. 60-second TTL is a compromise
/// between two bad extremes: 0 TTL means a DB query per request (a
/// non-starter at any meaningful load), infinite TTL means a freshly
/// deactivated account keeps working until the app restarts. 60s is
/// the SLA stated in the spec for "deactivation eventually kicks
/// in".
/// </summary>
public sealed class UserActivationChecker : IUserActivationChecker
{
  internal static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

  private static string Key(Guid userId) => $"user-active:{userId}";

  private readonly IAppDbContext _db;
  private readonly IMemoryCache _cache;

  public UserActivationChecker(IAppDbContext db, IMemoryCache cache)
  {
    _db = db;
    _cache = cache;
  }

  public async Task<bool> IsActiveAsync(Guid userId, CancellationToken cancellationToken = default)
  {
    if (userId == Guid.Empty) return false;
    if (_cache.TryGetValue<bool>(Key(userId), out var cached)) return cached;

    // Composite query: returns false both for missing rows and for
    // rows with IsActive=false. Anonymous projection so we touch
    // exactly one column (plus the WHERE on id).
    var active = await _db.Users
      .AsNoTracking()
      .Where(x => x.Id == userId)
      .Select(x => (bool?)x.IsActive)
      .FirstOrDefaultAsync(cancellationToken) ?? false;

    _cache.Set(Key(userId), active, CacheTtl);
    return active;
  }

  public void Invalidate(Guid userId) => _cache.Remove(Key(userId));
}
