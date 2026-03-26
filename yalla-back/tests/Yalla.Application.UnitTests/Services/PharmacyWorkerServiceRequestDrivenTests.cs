using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Exceptions;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public class PharmacyWorkerServiceRequestDrivenTests
{
  [Fact]
  public async Task RegisterPharmacyAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.RegisterPharmacyAsync(null!));
  }

  [Fact]
  public async Task UpdatePharmacyAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.UpdatePharmacyAsync(null!));
  }

  [Fact]
  public async Task DeletePharmacyAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.DeletePharmacyAsync(null!));
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.RegisterPharmacyWorkerAsync(null!));
  }

  [Fact]
  public async Task DeletePharmacyWorkerAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.DeletePharmacyWorkerAsync(null!));
  }

  [Fact]
  public async Task GetAdminsAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.GetAdminsAsync(null!));
  }

  [Fact]
  public async Task UpdatePharmacyAsync_ThrowsWhenPharmacyMissing()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100001", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdatePharmacyAsync(new UpdatePharmacyRequest
    {
      PharmacyId = Guid.NewGuid(),
      Title = "Updated",
      Address = "New address",
      AdminId = admin.Id,
      IsActive = true
    }));
  }

  [Fact]
  public async Task UpdatePharmacyAsync_ThrowsWhenAdminMissing()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100002", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "Old address", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdatePharmacyAsync(new UpdatePharmacyRequest
    {
      PharmacyId = pharmacy.Id,
      Title = "Updated",
      Address = "New address",
      AdminId = Guid.NewGuid(),
      IsActive = false
    }));
  }

  [Fact]
  public async Task UpdatePharmacyAsync_UpdatesFieldsAndActivity()
  {
    using var scope = TestDbFactory.Create();
    var admin1 = TestDbFactory.CreateUser("Admin1", "993100003", Role.Admin);
    var admin2 = TestDbFactory.CreateUser("Admin2", "993100004", Role.Admin);
    scope.Db.Users.AddRange(admin1, admin2);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "Old address", admin1.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());
    var response = await service.UpdatePharmacyAsync(new UpdatePharmacyRequest
    {
      PharmacyId = pharmacy.Id,
      Title = "Updated title",
      Address = "New address",
      AdminId = admin2.Id,
      IsActive = false
    });

    Assert.Equal("Updated title", response.Pharmacy.Title);
    Assert.Equal("New address", response.Pharmacy.Address);
    Assert.Equal(admin2.Id, response.Pharmacy.AdminId);
    Assert.False(response.Pharmacy.IsActive);
  }

  [Fact]
  public async Task DeletePharmacyAsync_ThrowsWhenMissing()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeletePharmacyAsync(new DeletePharmacyRequest
    {
      PharmacyId = Guid.NewGuid()
    }));
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_ThrowsForMissingPharmacy()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.RegisterPharmacyWorkerAsync(new RegisterPharmacyWorkerRequest
    {
      Name = "Worker",
      PhoneNumber = "993100005",
      Password = "Passw0rd!",
      PharmacyId = Guid.NewGuid()
    }));
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_ThrowsForInvalidPhone()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100006", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();
    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<DomainArgumentException>(() => service.RegisterPharmacyWorkerAsync(new RegisterPharmacyWorkerRequest
    {
      Name = "Worker",
      PhoneNumber = "bad-phone",
      Password = "Passw0rd!",
      PharmacyId = pharmacy.Id
    }));
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_TrimsPhoneNumber()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100007", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();
    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());
    var response = await service.RegisterPharmacyWorkerAsync(new RegisterPharmacyWorkerRequest
    {
      Name = "Worker",
      PhoneNumber = " 993100008 ",
      Password = "Passw0rd!",
      PharmacyId = pharmacy.Id
    });

    Assert.Equal("993100008", response.PharmacyWorker.PhoneNumber);
  }

  [Fact]
  public async Task DeletePharmacyWorkerAsync_ThrowsWhenMissing()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeletePharmacyWorkerAsync(new DeletePharmacyWorkerRequest
    {
      PharmacyWorkerId = Guid.NewGuid()
    }));
  }

  [Fact]
  public async Task DeletePharmacyWorkerAsync_RemovesWorker()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100009", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();
    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();
    var worker = TestDbFactory.CreateWorker("Worker", "993100010", pharmacy.Id, pharmacy);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());
    var response = await service.DeletePharmacyWorkerAsync(new DeletePharmacyWorkerRequest
    {
      PharmacyWorkerId = worker.Id
    });

    Assert.Equal(worker.Id, response.DeletedPharmacyWorkerId);
    Assert.False(await scope.Db.PharmacyWorkers.AnyAsync(x => x.Id == worker.Id));
  }

  [Fact]
  public async Task DeletePharmacyWorkerInPharmacyAsync_ThrowsWhenWorkerFromAnotherPharmacy()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100011", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy1 = TestDbFactory.CreatePharmacy("P1", "A1", admin.Id);
    var pharmacy2 = TestDbFactory.CreatePharmacy("P2", "A2", admin.Id);
    scope.Db.Pharmacies.AddRange(pharmacy1, pharmacy2);
    await scope.Db.SaveChangesAsync();

    var worker = TestDbFactory.CreateWorker("Worker", "993100012", pharmacy2.Id, pharmacy2);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeletePharmacyWorkerInPharmacyAsync(
      new DeletePharmacyWorkerRequest { PharmacyWorkerId = worker.Id },
      pharmacy1.Id));
  }

  [Fact]
  public async Task DeletePharmacyWorkerInPharmacyAsync_RemovesWorkerInSamePharmacy()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "993100013", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var worker = TestDbFactory.CreateWorker("Worker", "993100014", pharmacy.Id, pharmacy);
    scope.Db.PharmacyWorkers.Add(worker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher(), new NoOpRealtimeUpdatesPublisher());
    var response = await service.DeletePharmacyWorkerInPharmacyAsync(
      new DeletePharmacyWorkerRequest { PharmacyWorkerId = worker.Id },
      pharmacy.Id);

    Assert.Equal(worker.Id, response.DeletedPharmacyWorkerId);
    Assert.False(await scope.Db.PharmacyWorkers.AnyAsync(x => x.Id == worker.Id));
  }
}
