using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public class PharmacyWorkerServiceTests
{
  [Fact]
  public async Task RegisterPharmacyAsync_CreatesPharmacy()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "992200001", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());
    var response = await service.RegisterPharmacyAsync(new RegisterPharmacyRequest
    {
      Title = "Ph-1",
      Address = "Addr",
      AdminId = admin.Id
    });

    Assert.Equal("Ph-1", response.Pharmacy.Title);
    Assert.Single(scope.Db.Pharmacies);
  }

  [Fact]
  public async Task RegisterPharmacyAsync_ThrowsWhenAdminMissing()
  {
    using var scope = TestDbFactory.Create();
    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.RegisterPharmacyAsync(new RegisterPharmacyRequest
    {
      Title = "P",
      Address = "A",
      AdminId = Guid.NewGuid()
    }));
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_CreatesWorker()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "992200002", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());
    var response = await service.RegisterPharmacyWorkerAsync(new RegisterPharmacyWorkerRequest
    {
      Name = "Worker",
      PhoneNumber = "992200003",
      Password = "Passw0rd!",
      PharmacyId = pharmacy.Id
    });

    Assert.Equal(pharmacy.Id, response.PharmacyWorker.PharmacyId);
    Assert.Equal(1, await scope.Db.PharmacyWorkers.CountAsync());
  }

  [Fact]
  public async Task RegisterPharmacyWorkerAsync_ThrowsForDuplicatePhone()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "992200004", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var existingWorker = TestDbFactory.CreateWorker("W1", "992200005", pharmacy.Id, pharmacy);
    scope.Db.PharmacyWorkers.Add(existingWorker);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.RegisterPharmacyWorkerAsync(new RegisterPharmacyWorkerRequest
    {
      Name = "W2",
      PhoneNumber = "992200005",
      Password = "Passw0rd!",
      PharmacyId = pharmacy.Id
    }));
  }

  [Fact]
  public async Task DeletePharmacyAsync_DeactivatesPharmacyWithoutRemovingRelatedData()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "992200006", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var pharmacy = TestDbFactory.CreatePharmacy("P", "A", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("M", "M-1");
    scope.Db.Medicines.Add(medicine);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var worker = TestDbFactory.CreateWorker("W", "992200007", pharmacy.Id, pharmacy);
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, 10, 12m);
    scope.Db.PharmacyWorkers.Add(worker);
    scope.Db.Offers.Add(offer);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());
    await service.DeletePharmacyAsync(new DeletePharmacyRequest { PharmacyId = pharmacy.Id });

    var updatedPharmacy = await scope.Db.Pharmacies.AsNoTracking().FirstAsync(x => x.Id == pharmacy.Id);
    Assert.False(updatedPharmacy.IsActive);
    Assert.True(await scope.Db.PharmacyWorkers.AnyAsync(x => x.PharmacyId == pharmacy.Id));
    Assert.True(await scope.Db.Offers.AnyAsync(x => x.PharmacyId == pharmacy.Id));
    Assert.True(await scope.Db.Users.AnyAsync(x => x.Id == admin.Id));
  }

  [Fact]
  public async Task GetActivePharmaciesAsync_ReturnsOnlyActive()
  {
    using var scope = TestDbFactory.Create();
    var admin = TestDbFactory.CreateUser("Admin", "992200008", Role.Admin);
    scope.Db.Users.Add(admin);
    await scope.Db.SaveChangesAsync();

    var active = TestDbFactory.CreatePharmacy("Active", "A", admin.Id, isActive: true);
    var inactive = TestDbFactory.CreatePharmacy("Inactive", "B", admin.Id, isActive: false);
    scope.Db.Pharmacies.AddRange(active, inactive);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());
    var response = await service.GetActivePharmaciesAsync();

    Assert.Single(response.Pharmacies);
    Assert.Equal(active.Id, response.Pharmacies.Single().Id);
  }

  [Fact]
  public async Task GetAdminsAsync_ReturnsPagedAdmins()
  {
    using var scope = TestDbFactory.Create();
    var admin1 = TestDbFactory.CreateUser("Admin-1", "992299991", Role.Admin);
    var admin2 = TestDbFactory.CreateUser("Admin-2", "992299992", Role.Admin);
    scope.Db.Users.AddRange(admin1, admin2);
    await scope.Db.SaveChangesAsync();

    var pharmacy1 = TestDbFactory.CreatePharmacy("Ph-1", "Addr-1", admin1.Id, isActive: true);
    var pharmacy2 = TestDbFactory.CreatePharmacy("Ph-2", "Addr-2", admin2.Id, isActive: false);
    scope.Db.Pharmacies.AddRange(pharmacy1, pharmacy2);
    await scope.Db.SaveChangesAsync();

    var worker1 = TestDbFactory.CreateWorker("Worker-1", "992299993", pharmacy1.Id, pharmacy1);
    var worker2 = TestDbFactory.CreateWorker("Worker-2", "992299994", pharmacy2.Id, pharmacy2);
    scope.Db.PharmacyWorkers.AddRange(worker1, worker2);
    await scope.Db.SaveChangesAsync();

    var service = new PharmacyWorkerService(scope.Db, new BCryptPasswordHasher());
    var response = await service.GetAdminsAsync(new GetAdminsRequest
    {
      Page = 1,
      PageSize = 1
    });

    Assert.Equal(2, response.TotalCount);
    Assert.Single(response.Admins);
    Assert.Equal(1, response.Page);
    Assert.Equal(1, response.PageSize);
    Assert.NotEqual(Guid.Empty, response.Admins.Single().PharmacyId);
  }
}
