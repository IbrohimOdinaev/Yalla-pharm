using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Sms;

namespace Yalla.Application.UnitTests.Services;

public sealed class SmsVerificationCleanupHostedServiceTests
{
  [Fact]
  public async Task ExecuteAsync_ShouldDeleteExpiredPendingAndOldCompletedSessions()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;

    var nowUtc = DateTime.UtcNow;
    var oldExpiredPending = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111001",
      "HASH-1",
      nowUtc.AddHours(-5),
      nowUtc.AddHours(-5),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");

    var freshPending = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111002",
      "HASH-2",
      nowUtc.AddHours(2),
      nowUtc.AddMinutes(1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");

    var oldVerified = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111003",
      "HASH-3",
      nowUtc.AddMinutes(30),
      nowUtc.AddMinutes(1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    oldVerified.MarkVerified(nowUtc.AddHours(-30));

    db.SmsVerificationSessions.AddRange(oldExpiredPending, freshPending, oldVerified);
    await db.SaveChangesAsync();

    var veryOldUpdatedAtUtc = nowUtc.AddHours(-30);
    _ = await db.Database.ExecuteSqlInterpolatedAsync(
      $"UPDATE sms_verification_sessions SET updated_at_utc = {veryOldUpdatedAtUtc} WHERE id = {oldVerified.Id}");

    using var provider = new ServiceCollection()
      .AddSingleton<AppDbContext>(db)
      .BuildServiceProvider();

    var cleanupService = new SmsVerificationCleanupHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new SmsVerificationOptions
      {
        CleanupIntervalMinutes = 1,
        ExpiredSessionRetentionMinutes = 120,
        CompletedSessionRetentionHours = 24
      }),
      NullLogger<SmsVerificationCleanupHostedService>.Instance);

    await cleanupService.StartAsync(CancellationToken.None);
    await Task.Delay(200);
    await cleanupService.StopAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var remainingIds = await db.SmsVerificationSessions
      .AsNoTracking()
      .Select(x => x.Id)
      .ToListAsync();

    Assert.DoesNotContain(oldExpiredPending.Id, remainingIds);
    Assert.DoesNotContain(oldVerified.Id, remainingIds);
    Assert.Contains(freshPending.Id, remainingIds);
  }

  [Fact]
  public async Task ExecuteAsync_ShouldKeepRecentlyCompletedSessions()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;

    var recentVerified = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111004",
      "HASH-4",
      DateTime.UtcNow.AddMinutes(30),
      DateTime.UtcNow.AddMinutes(1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    recentVerified.MarkVerified(DateTime.UtcNow.AddMinutes(-5));

    db.SmsVerificationSessions.Add(recentVerified);
    await db.SaveChangesAsync();

    using var provider = new ServiceCollection()
      .AddSingleton<AppDbContext>(db)
      .BuildServiceProvider();

    var cleanupService = new SmsVerificationCleanupHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new SmsVerificationOptions
      {
        CleanupIntervalMinutes = 1,
        ExpiredSessionRetentionMinutes = 120,
        CompletedSessionRetentionHours = 24
      }),
      NullLogger<SmsVerificationCleanupHostedService>.Instance);

    await cleanupService.StartAsync(CancellationToken.None);
    await Task.Delay(200);
    await cleanupService.StopAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var exists = await db.SmsVerificationSessions
      .AsNoTracking()
      .AnyAsync(x => x.Id == recentVerified.Id && x.Status == SmsVerificationStatus.Verified);

    Assert.True(exists);
  }
}
