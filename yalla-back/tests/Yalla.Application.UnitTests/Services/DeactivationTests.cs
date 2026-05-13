using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Services;

public sealed class DeactivationTests
{
  // ── Domain — User.Deactivate / Activate ────────────────────────

  [Fact]
  public void User_Deactivate_sets_flag_and_captures_metadata()
  {
    var admin = TestDbFactory.CreateClient("Su", "999999991"); // any User subtype works
    var actor = Guid.NewGuid();
    var ts = new DateTime(2026, 5, 12, 10, 0, 0, DateTimeKind.Utc);

    admin.Deactivate(actor, "compromised credentials", ts);

    Assert.False(admin.IsActive);
    Assert.Equal(actor, admin.DeactivatedByUserId);
    Assert.Equal("compromised credentials", admin.DeactivationReason);
    Assert.Equal(ts, admin.DeactivatedAtUtc);
  }

  [Fact]
  public void User_Activate_clears_deactivation_metadata()
  {
    var u = TestDbFactory.CreateClient("Su", "999999992");
    var actor = Guid.NewGuid();
    u.Deactivate(actor, "x", DateTime.UtcNow);

    u.Activate(actor);

    Assert.True(u.IsActive);
    Assert.Null(u.DeactivatedAtUtc);
    Assert.Null(u.DeactivatedByUserId);
    Assert.Null(u.DeactivationReason);
  }

  [Fact]
  public void User_Deactivate_rejects_empty_actor()
  {
    var u = TestDbFactory.CreateClient("Su", "999999993");
    Assert.Throws<DomainArgumentException>(() =>
      u.Deactivate(Guid.Empty, "x", DateTime.UtcNow));
  }

  [Fact]
  public void User_Deactivate_clamps_reason_to_500_chars()
  {
    var u = TestDbFactory.CreateClient("Su", "999999994");
    var longReason = new string('A', 600);
    u.Deactivate(Guid.NewGuid(), longReason, DateTime.UtcNow);
    Assert.Equal(500, u.DeactivationReason!.Length);
  }

  // ── Service — PharmacyWorker rejects double-deactivation ──────

  [Fact]
  public async Task DeactivatePharmacyWorker_rejects_already_inactive()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateClient("Su", "999999995");
    scope.Db.Clients.Add(admin);
    var pharmacy = TestDbFactory.CreatePharmacy("A", "Addr", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    var worker = TestDbFactory.CreateWorker("W", "111111115", pharmacy.Id, pharmacy);
    worker.Deactivate(admin.Id, null, DateTime.UtcNow);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(
      scope.Db, new FakePasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ConflictException>(() =>
      service.DeactivatePharmacyWorkerAsync(worker.Id, admin.Id, new DeactivateUserRequest()));
  }

  [Fact]
  public async Task DeactivatePharmacyWorker_flips_active_flag()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateClient("Su", "999999996");
    scope.Db.Clients.Add(admin);
    var pharmacy = TestDbFactory.CreatePharmacy("A", "Addr", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    var worker = TestDbFactory.CreateWorker("W", "111111116", pharmacy.Id, pharmacy);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(
      scope.Db, new FakePasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    var response = await service.DeactivatePharmacyWorkerAsync(
      worker.Id, admin.Id, new DeactivateUserRequest { Reason = "test" });

    Assert.False(response.IsActive);
    Assert.Equal(0, response.OpenWorkItemsCount); // none seeded
    Assert.Null(response.Warning);

    var refreshed = await scope.Db.PharmacyWorkers.AsNoTracking()
      .SingleAsync(w => w.Id == worker.Id);
    Assert.False(refreshed.IsActive);
    Assert.Equal("test", refreshed.DeactivationReason);
    Assert.Equal(admin.Id, refreshed.DeactivatedByUserId);
  }

  [Fact]
  public async Task ActivatePharmacyWorker_restores_active_flag()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateClient("Su", "999999997");
    scope.Db.Clients.Add(admin);
    var pharmacy = TestDbFactory.CreatePharmacy("A", "Addr", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    var worker = TestDbFactory.CreateWorker("W", "111111117", pharmacy.Id, pharmacy);
    worker.Deactivate(admin.Id, "before", DateTime.UtcNow);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(
      scope.Db, new FakePasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    var response = await service.ActivatePharmacyWorkerAsync(worker.Id, admin.Id);

    Assert.True(response.IsActive);
    var refreshed = await scope.Db.PharmacyWorkers.AsNoTracking()
      .SingleAsync(w => w.Id == worker.Id);
    Assert.True(refreshed.IsActive);
    Assert.Null(refreshed.DeactivationReason);
  }
}

internal sealed class FakePasswordHasher : Yalla.Application.Abstractions.IPasswordHasher
{
  public string HashPassword(string password) => $"hash:{password}";
  public bool VerifyPassword(string password, string passwordHash) => passwordHash == $"hash:{password}";
}
