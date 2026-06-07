using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public sealed class StaffCompensationServiceTests
{
  [Fact]
  public async Task StaffPayoutRequest_ShouldReserveBalanceAndCompletionShouldCreatePayout()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var superAdmin = TestDbFactory.CreateUser("Super", "911300001", Role.SuperAdmin);
    var staff = TestDbFactory.CreateUser("Pharmacist", "911300002", Role.Pharmacist);
    db.Users.AddRange(superAdmin, staff);
    db.StaffCompensationEarnings.Add(new StaffCompensationEarning(
      staff.Id,
      Role.Pharmacist,
      StaffCompensationSourceType.PrescriptionDecoded,
      Guid.NewGuid(),
      15m));
    await db.SaveChangesAsync();

    var service = new StaffCompensationService(db, new TestManualLookupImageStorage());
    var request = await service.CreatePayoutRequestAsync(
      staff.Id,
      new CreateStaffPayoutRequestRequest
      {
        Bank = "Alif",
        WalletPhoneNumber = "+992900000123"
      });

    Assert.Equal(15m, request.Amount);
    Assert.Equal("New", request.Status);
    Assert.Contains("alifmobi:///toMobi", request.DeepLinkUrl);
    Assert.Contains("account=%2B992900000123", request.DeepLinkUrl);

    var reservedSummary = await service.GetSummaryAsync(staff.Id);
    Assert.Equal(15m, reservedSummary.PendingPayoutAmount);
    Assert.Equal(0m, reservedSummary.BalanceAmount);

    var completed = await service.CompletePayoutRequestAsync(
      superAdmin.Id,
      request.Id,
      "receipts/staff.png",
      "paid by app");

    Assert.Equal("Completed", completed.Status);
    Assert.Equal("paid by app", completed.Note);
    Assert.NotNull(completed.PayoutId);
    Assert.NotNull(completed.ReceiptImageUrl);

    var finalSummary = await service.GetSummaryAsync(staff.Id);
    Assert.Equal(0m, finalSummary.PendingPayoutAmount);
    Assert.Equal(15m, finalSummary.PaidAmount);
    Assert.Equal(0m, finalSummary.BalanceAmount);
    Assert.Equal(1, await db.StaffCompensationPayouts.CountAsync(x => x.StaffUserId == staff.Id));
  }
}
