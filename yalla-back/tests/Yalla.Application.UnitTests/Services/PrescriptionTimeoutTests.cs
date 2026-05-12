using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Payments;

namespace Yalla.Application.UnitTests.Services;

public sealed class PrescriptionTimeoutTests
{
  private static (IServiceScopeFactory scopeFactory, AppDbContext db, IDisposable scope)
    BuildScope(TestDbScope dbScope)
  {
    var services = new ServiceCollection();
    services.AddSingleton(dbScope.Db);
    services.AddSingleton<AppDbContext>(_ => dbScope.Db);
    services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
    services.AddSingleton<IRealtimeUpdatesPublisher, NoOpRealtimeUpdatesPublisher>();
    var provider = services.BuildServiceProvider();
    return (provider.GetRequiredService<IServiceScopeFactory>(), dbScope.Db, provider);
  }

  private static PrescriptionPaymentTimeoutHostedService BuildWorker(
    IServiceScopeFactory factory, int timeoutHours = 24)
  {
    var options = Options.Create(new PrescriptionTimeoutOptions
    {
      PaymentTimeoutHours = timeoutHours,
      PaymentTimeoutCheckIntervalMinutes = 10,
    });
    return new PrescriptionPaymentTimeoutHostedService(
      factory, options, NullLogger<PrescriptionPaymentTimeoutHostedService>.Instance);
  }

  // ── Domain — Cancel(reason) ────────────────────────────────────

  [Fact]
  public void Cancel_with_payment_timeout_records_reason_and_timestamp()
  {
    var p = new Prescription(Guid.NewGuid(), patientAge: 30, clientComment: null,
      images: new[] { new PrescriptionImage("k", 0) },
      preferenceTier: PrescriptionPreferenceTier.AsPrescribed);

    p.Cancel(PrescriptionCancellationReason.PaymentTimeout);

    Assert.Equal(PrescriptionStatus.Cancelled, p.Status);
    Assert.Equal(PrescriptionCancellationReason.PaymentTimeout, p.CancellationReason);
    Assert.NotNull(p.CancelledAtUtc);
  }

  [Fact]
  public void Cancel_with_payment_timeout_is_benign_when_already_cancelled()
  {
    var p = new Prescription(Guid.NewGuid(), 30, null, new[] { new PrescriptionImage("k", 0) }, PrescriptionPreferenceTier.AsPrescribed);
    p.Cancel(PrescriptionCancellationReason.ClientCancelled);
    var firstReason = p.CancellationReason;
    var firstAt = p.CancelledAtUtc;

    // PaymentTimeout retry on an already-cancelled row must not throw
    // and must not rewrite the reason — original ClientCancelled wins.
    p.Cancel(PrescriptionCancellationReason.PaymentTimeout);

    Assert.Equal(firstReason, p.CancellationReason);
    Assert.Equal(firstAt, p.CancelledAtUtc);
  }

  [Fact]
  public void Cancel_with_other_reason_on_cancelled_throws()
  {
    var p = new Prescription(Guid.NewGuid(), 30, null, new[] { new PrescriptionImage("k", 0) }, PrescriptionPreferenceTier.AsPrescribed);
    p.Cancel(PrescriptionCancellationReason.PaymentTimeout);

    Assert.Throws<DomainException>(() =>
      p.Cancel(PrescriptionCancellationReason.ClientCancelled));
  }

  // ── Worker — cancel only old + skip young + skip terminal ─────

  [Fact]
  public async Task Worker_cancels_prescription_older_than_ttl()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("C", "111111121");
    scope.Db.Clients.Add(client);

    var p = new Prescription(client.Id, 30, null, new[] { new PrescriptionImage("k", 0) }, PrescriptionPreferenceTier.AsPrescribed);
    scope.Db.Prescriptions.Add(p);
    await scope.Db.SaveChangesAsync();
    // Backdate by 25h so the TTL of 24h catches it.
    await scope.Db.Database.ExecuteSqlRawAsync(
      "UPDATE prescriptions SET created_at_utc = {0} WHERE id = {1}",
      DateTime.UtcNow.AddHours(-25), p.Id);

    var (factory, _, _) = BuildScope(scope);
    var worker = BuildWorker(factory);

    var count = await worker.CancelExpiredAsync(default);

    Assert.Equal(1, count);
    var refreshed = await scope.Db.Prescriptions.AsNoTracking().SingleAsync(x => x.Id == p.Id);
    Assert.Equal(PrescriptionStatus.Cancelled, refreshed.Status);
    Assert.Equal(PrescriptionCancellationReason.PaymentTimeout, refreshed.CancellationReason);
  }

  [Fact]
  public async Task Worker_skips_prescriptions_younger_than_ttl()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("C", "111111122");
    scope.Db.Clients.Add(client);
    var p = new Prescription(client.Id, 30, null, new[] { new PrescriptionImage("k", 0) }, PrescriptionPreferenceTier.AsPrescribed);
    scope.Db.Prescriptions.Add(p);
    await scope.Db.SaveChangesAsync();
    // CreatedAtUtc defaulted to "now" — well inside the 24h window.

    var (factory, _, _) = BuildScope(scope);
    var worker = BuildWorker(factory);

    var count = await worker.CancelExpiredAsync(default);

    Assert.Equal(0, count);
    var refreshed = await scope.Db.Prescriptions.AsNoTracking().SingleAsync(x => x.Id == p.Id);
    Assert.Equal(PrescriptionStatus.Submitted, refreshed.Status);
    Assert.Null(refreshed.CancellationReason);
  }

  [Fact]
  public async Task Worker_is_idempotent_on_already_cancelled_rows()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("C", "111111123");
    scope.Db.Clients.Add(client);
    var p = new Prescription(client.Id, 30, null, new[] { new PrescriptionImage("k", 0) }, PrescriptionPreferenceTier.AsPrescribed);
    p.Cancel(PrescriptionCancellationReason.ClientCancelled);  // already cancelled
    scope.Db.Prescriptions.Add(p);
    await scope.Db.SaveChangesAsync();
    await scope.Db.Database.ExecuteSqlRawAsync(
      "UPDATE prescriptions SET created_at_utc = {0} WHERE id = {1}",
      DateTime.UtcNow.AddHours(-25), p.Id);

    var (factory, _, _) = BuildScope(scope);
    var worker = BuildWorker(factory);

    var count = await worker.CancelExpiredAsync(default);

    // Already-cancelled is filtered out by the worker's query (only
    // Submitted/AwaitingConfirmation enter the sweep), so it's a clean
    // zero-count pass — not a hidden re-cancel.
    Assert.Equal(0, count);
    var refreshed = await scope.Db.Prescriptions.AsNoTracking().SingleAsync(x => x.Id == p.Id);
    Assert.Equal(PrescriptionCancellationReason.ClientCancelled, refreshed.CancellationReason);
  }
}
