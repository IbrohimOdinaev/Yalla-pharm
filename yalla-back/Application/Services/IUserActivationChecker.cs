namespace Yalla.Application.Services;

/// <summary>
/// Tiny per-request facade over the User table that the JWT
/// validation handler consults to refuse already-issued tokens for
/// accounts that have since been deactivated. Implementation is
/// expected to cache results in <see cref="Microsoft.Extensions.Caching.Memory.IMemoryCache"/>
/// for a short window (~60s) — we don't want every request to hit
/// the DB just to confirm the account is still alive.
/// </summary>
public interface IUserActivationChecker
{
  /// <summary>Returns true iff the user exists AND is active.
  /// Returns false for missing users so a deleted account's tokens
  /// also stop working. Negative answers are cached just like
  /// positives so a hostile token can't beat the cache by sending
  /// thousands of requests during the TTL.</summary>
  Task<bool> IsActiveAsync(Guid userId, CancellationToken cancellationToken = default);

  /// <summary>Manually invalidate a user's cached state — called
  /// right after activate/deactivate so the change takes effect on
  /// the very next request, not after the cache TTL.</summary>
  void Invalidate(Guid userId);
}
