using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public sealed class RefundRequestServiceTests
{
  [Fact]
  public async Task GetRefundRequestsAsync_FiltersByStatus()
  {
    using var scope = TestDbFactory.Create();

    var superAdmin = TestDbFactory.CreateUser("SA", "993000001", Role.SuperAdmin);
    var admin = TestDbFactory.CreateUser("Admin", "993000002", Role.Admin);
    var client = TestDbFactory.CreateClient("Client", "993000003");
    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy", "Addr", admin.Id);

    scope.Db.Users.AddRange(superAdmin, admin);
    scope.Db.Clients.Add(client);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var created = new RefundRequest(
      orderId: null,
      clientId: client.Id,
      pharmacyId: pharmacy.Id,
      amount: 20m,
      currency: "TJS",
      paymentTransactionId: "tx-created",
      reason: "Checkout failed");

    var initiated = new RefundRequest(
      orderId: null,
      clientId: client.Id,
      pharmacyId: pharmacy.Id,
      amount: 30m,
      currency: "TJS",
      paymentTransactionId: "tx-initiated",
      reason: "Order cancelled");
    initiated.MarkInitiatedBySuperAdmin();

    scope.Db.RefundRequests.AddRange(created, initiated);
    await scope.Db.SaveChangesAsync();

    var service = new RefundRequestService(scope.Db);
    var response = await service.GetRefundRequestsAsync(new GetRefundRequestsRequest
    {
      Status = RefundRequestStatus.Created,
      Page = 1,
      PageSize = 50
    });

    Assert.Equal(1, response.TotalCount);
    Assert.Single(response.RefundRequests);
    Assert.Equal(created.Id, response.RefundRequests.Single().RefundRequestId);
    Assert.Equal(RefundRequestStatus.Created, response.RefundRequests.Single().Status);
  }

  [Fact]
  public async Task InitiateRefundBySuperAdminAsync_ChangesStatus()
  {
    using var scope = TestDbFactory.Create();

    var superAdmin = TestDbFactory.CreateUser("SA", "993000011", Role.SuperAdmin);
    var admin = TestDbFactory.CreateUser("Admin", "993000012", Role.Admin);
    var client = TestDbFactory.CreateClient("Client", "993000013");
    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy", "Addr", admin.Id);

    scope.Db.Users.AddRange(superAdmin, admin);
    scope.Db.Clients.Add(client);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var refundRequest = new RefundRequest(
      orderId: null,
      clientId: client.Id,
      pharmacyId: pharmacy.Id,
      amount: 40m,
      currency: "TJS",
      paymentTransactionId: "tx-1",
      reason: "Checkout failed");

    scope.Db.RefundRequests.Add(refundRequest);
    await scope.Db.SaveChangesAsync();

    var service = new RefundRequestService(scope.Db);
    var response = await service.InitiateRefundBySuperAdminAsync(new InitiateRefundBySuperAdminRequest
    {
      SuperAdminId = superAdmin.Id,
      RefundRequestId = refundRequest.Id
    });

    scope.Db.ChangeTracker.Clear();
    var saved = await scope.Db.RefundRequests
      .AsNoTracking()
      .FirstAsync(x => x.Id == refundRequest.Id);

    Assert.Equal(RefundRequestStatus.Created, response.PreviousStatus);
    Assert.Equal(RefundRequestStatus.InitiatedBySuperAdmin, response.Status);
    Assert.Equal(RefundRequestStatus.InitiatedBySuperAdmin, saved.Status);
  }

  [Fact]
  public async Task InitiateRefundBySuperAdminAsync_ThrowsWhenActorIsNotSuperAdmin()
  {
    using var scope = TestDbFactory.Create();

    var admin = TestDbFactory.CreateUser("Admin", "993000021", Role.Admin);
    var client = TestDbFactory.CreateClient("Client", "993000022");
    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy", "Addr", admin.Id);

    scope.Db.Users.Add(admin);
    scope.Db.Clients.Add(client);
    scope.Db.Pharmacies.Add(pharmacy);
    await scope.Db.SaveChangesAsync();

    var refundRequest = new RefundRequest(
      orderId: null,
      clientId: client.Id,
      pharmacyId: pharmacy.Id,
      amount: 50m,
      currency: "TJS",
      paymentTransactionId: "tx-2",
      reason: "Checkout failed");

    scope.Db.RefundRequests.Add(refundRequest);
    await scope.Db.SaveChangesAsync();

    var service = new RefundRequestService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.InitiateRefundBySuperAdminAsync(
      new InitiateRefundBySuperAdminRequest
      {
        SuperAdminId = admin.Id,
        RefundRequestId = refundRequest.Id
      }));
  }

  [Fact]
  public async Task InitiateRefundBySuperAdminAsync_ThrowsWhenRefundRequestNotFound()
  {
    using var scope = TestDbFactory.Create();
    var superAdmin = TestDbFactory.CreateUser("SA", "993000031", Role.SuperAdmin);
    scope.Db.Users.Add(superAdmin);
    await scope.Db.SaveChangesAsync();

    var service = new RefundRequestService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.InitiateRefundBySuperAdminAsync(
      new InitiateRefundBySuperAdminRequest
      {
        SuperAdminId = superAdmin.Id,
        RefundRequestId = Guid.NewGuid()
      }));
  }
}
