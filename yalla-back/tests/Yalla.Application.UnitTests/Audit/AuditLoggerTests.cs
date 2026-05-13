using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Infrastructure.Audit;

namespace Yalla.Application.UnitTests.Audit;

public sealed class AuditLoggerTests
{
  private sealed class FakeUserContext : ICurrentUserContext
  {
    public Guid? UserId { get; init; }
    public Role? Role { get; init; }
    public string? Ip { get; init; }
    public Guid? CorrelationId { get; init; }
  }

  [Fact]
  public async Task LogAsync_writes_entry_with_actor_and_correlation()
  {
    using var scope = TestDbFactory.Create();
    var userId = Guid.NewGuid();
    var corr = Guid.NewGuid();
    var ctx = new FakeUserContext
    {
      UserId = userId,
      Role = Role.SuperAdmin,
      Ip = "10.0.0.1",
      CorrelationId = corr,
    };

    var logger = new AuditLogger(scope.Db, ctx, NullLogger<AuditLogger>.Instance);
    var entityId = Guid.NewGuid();

    await logger.LogAsync(
      AuditAction.PaymentConfirmed,
      "PaymentIntent",
      entityId,
      "Manual confirm.",
      payload: new { foo = "bar", n = 42 });

    await scope.Db.SaveChangesAsync();

    var saved = await scope.Db.AuditLogs.AsNoTracking().SingleAsync();
    Assert.Equal(AuditAction.PaymentConfirmed, saved.Action);
    Assert.Equal("PaymentIntent", saved.EntityType);
    Assert.Equal(entityId, saved.EntityId);
    Assert.Equal(userId, saved.ActorUserId);
    Assert.Equal(Role.SuperAdmin, saved.ActorRole);
    Assert.Equal("10.0.0.1", saved.ActorIp);
    Assert.Equal(corr, saved.CorrelationId);
    Assert.Contains("\"foo\":\"bar\"", saved.PayloadJson);
    Assert.Contains("\"n\":42", saved.PayloadJson);
  }

  [Fact]
  public async Task LogAsync_truncates_oversized_payload_to_marker()
  {
    using var scope = TestDbFactory.Create();
    var ctx = new FakeUserContext { UserId = Guid.NewGuid(), Role = Role.Client };
    var logger = new AuditLogger(scope.Db, ctx, NullLogger<AuditLogger>.Instance);

    // 20 KB ASCII blob — JSON-escaped to roughly the same size.
    var blob = new string('x', 20 * 1024);

    await logger.LogAsync(
      AuditAction.Updated,
      "Whatever",
      Guid.NewGuid(),
      "Big payload.",
      payload: new { blob });
    await scope.Db.SaveChangesAsync();

    var saved = await scope.Db.AuditLogs.AsNoTracking().SingleAsync();
    Assert.NotNull(saved.PayloadJson);
    // Marker is short — much smaller than the 16 KB cap.
    Assert.True(saved.PayloadJson!.Length < 200);
    Assert.Contains("\"truncated\":true", saved.PayloadJson);
    Assert.Contains("\"originalBytes\":", saved.PayloadJson);
  }

  [Fact]
  public async Task LogAsync_handles_null_payload_and_anonymous_actor()
  {
    using var scope = TestDbFactory.Create();
    var ctx = new FakeUserContext();  // all-null
    var logger = new AuditLogger(scope.Db, ctx, NullLogger<AuditLogger>.Instance);

    await logger.LogAsync(
      AuditAction.LoginFailed,
      "User",
      entityId: null,
      summary: "Anon failed login.",
      payload: null);
    await scope.Db.SaveChangesAsync();

    var saved = await scope.Db.AuditLogs.AsNoTracking().SingleAsync();
    Assert.Null(saved.ActorUserId);
    Assert.Null(saved.ActorRole);
    Assert.Null(saved.ActorIp);
    Assert.Null(saved.PayloadJson);
    Assert.Null(saved.EntityId);
    Assert.Equal("Anon failed login.", saved.Summary);
  }

  [Fact]
  public async Task LogAsync_clamps_overlong_summary_to_500_chars()
  {
    using var scope = TestDbFactory.Create();
    var ctx = new FakeUserContext { UserId = Guid.NewGuid(), Role = Role.SuperAdmin };
    var logger = new AuditLogger(scope.Db, ctx, NullLogger<AuditLogger>.Instance);

    var longSummary = new string('A', 700);
    await logger.LogAsync(
      AuditAction.Updated, "X", Guid.NewGuid(), longSummary, payload: null);
    await scope.Db.SaveChangesAsync();

    var saved = await scope.Db.AuditLogs.AsNoTracking().SingleAsync();
    Assert.Equal(500, saved.Summary.Length);
  }
}
