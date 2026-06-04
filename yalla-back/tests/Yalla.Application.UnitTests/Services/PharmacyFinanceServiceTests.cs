using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public sealed class PharmacyFinanceServiceTests
{
  [Fact]
  public async Task GetForAdminAsync_ShouldCountOnlyCompletedPaidOrderCost()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var (admin, pharmacy) = await SeedAdminPharmacyAsync(db);
    var client = TestDbFactory.CreateClient("Client", "911200001");
    var medicine = TestDbFactory.CreateMedicine("Medicine", "ART-FIN-1");

    var delivered = TestDbFactory.CreateOrder(
      client.Id,
      pharmacy.Id,
      "Delivery",
      (medicine, 25m, 2, false));
    MoveToDelivered(delivered);

    var ready = TestDbFactory.CreateOrder(
      client.Id,
      pharmacy.Id,
      "Delivery",
      (medicine, 100m, 1, false));
    MoveToReady(ready);

    db.Clients.Add(client);
    db.Medicines.Add(medicine);
    db.Orders.AddRange(delivered, ready);
    await db.SaveChangesAsync();

    var service = new PharmacyFinanceService(db, new TestManualLookupImageStorage());
    var finance = await service.GetForAdminAsync(admin.Id, pharmacy.Id);

    Assert.Equal(50m, finance.Summary.TotalOrderAmount);
    Assert.Equal(1, finance.Summary.CompletedOrdersCount);
    Assert.Equal(50m, finance.Summary.AvailableAmount);
  }

  [Fact]
  public async Task CreateWithdrawalRequestAsync_ShouldReserveAvailableBalance()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var (admin, pharmacy) = await SeedAdminPharmacyAsync(db);
    var client = TestDbFactory.CreateClient("Client", "911200002");
    var medicine = TestDbFactory.CreateMedicine("Medicine", "ART-FIN-2");
    var order = TestDbFactory.CreateOrder(
      client.Id,
      pharmacy.Id,
      "Pickup",
      isPickup: true,
      (medicine, 40m, 3, false));
    MoveToPickedUp(order);

    db.Clients.Add(client);
    db.Medicines.Add(medicine);
    db.Orders.Add(order);
    await db.SaveChangesAsync();

    var service = new PharmacyFinanceService(db, new TestManualLookupImageStorage());
    var withdrawal = await service.CreateWithdrawalRequestAsync(
      admin.Id,
      pharmacy.Id,
      new CreatePharmacyWithdrawalRequest
      {
        Bank = "Alif",
        WalletPhoneNumber = "+992900000001"
      });

    Assert.Equal(120m, withdrawal.Amount);
    Assert.Equal(PharmacyWithdrawalStatus.New, withdrawal.Status);
    Assert.Contains("alifmobi.page.link", withdrawal.DeepLinkUrl);

    var finance = await service.GetForAdminAsync(admin.Id, pharmacy.Id);
    Assert.Equal(0m, finance.Summary.AvailableAmount);
    Assert.Equal(120m, finance.Summary.PendingWithdrawalAmount);
  }

  private static async Task<(PharmacyWorker Admin, Pharmacy Pharmacy)> SeedAdminPharmacyAsync(Yalla.Infrastructure.AppDbContext db)
  {
    var superAdmin = TestDbFactory.CreateUser("Super", "911299999", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Finance Pharmacy", "Dushanbe", superAdmin.Id);
    var admin = TestDbFactory.CreateWorker("Admin", "911288888", pharmacy.Id, pharmacy);
    pharmacy.SetAdminId(admin.Id);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.PharmacyWorkers.Add(admin);
    await db.SaveChangesAsync();
    return (admin, pharmacy);
  }

  private static void MoveToReady(Order order)
  {
    order.NextStage(true);
    order.NextStage(true);
    order.NextStage(true);
  }

  private static void MoveToDelivered(Order order)
  {
    MoveToReady(order);
    order.NextStage(true);
    order.NextStage(true);
  }

  private static void MoveToPickedUp(Order order)
  {
    MoveToReady(order);
    order.NextStage(true);
  }
}

internal sealed class TestManualLookupImageStorage : IManualLookupImageStorage
{
  private readonly Dictionary<string, byte[]> _storage = new(StringComparer.Ordinal);

  public Task<ManualLookupImageContent> GetContentAsync(string key, CancellationToken cancellationToken = default)
  {
    var bytes = _storage.TryGetValue(key, out var stored) ? stored : [];
    return Task.FromResult(new ManualLookupImageContent
    {
      Content = new MemoryStream(bytes, writable: false),
      ContentType = "image/png"
    });
  }

  public async Task<string> UploadAsync(Stream content, string contentType, string fileName, CancellationToken cancellationToken = default)
  {
    using var memory = new MemoryStream();
    await content.CopyToAsync(memory, cancellationToken);
    var key = $"test/{fileName}";
    _storage[key] = memory.ToArray();
    return key;
  }

  public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
  {
    _storage.Remove(key);
    return Task.CompletedTask;
  }
}
