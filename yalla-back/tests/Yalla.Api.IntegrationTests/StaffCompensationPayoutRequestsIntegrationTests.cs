using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class StaffCompensationPayoutRequestsIntegrationTests : ApiTestBase
{
  public StaffCompensationPayoutRequestsIntegrationTests(ApiWebApplicationFactory factory) : base(factory)
  {
  }

  [Fact]
  public async Task StaffPayoutRequest_AdminCreatesAndSuperAdminCompletes_ShouldSubtractFromBalance()
  {
    using (var scope = Factory.CreateScope())
    {
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      db.StaffCompensationEarnings.Add(new StaffCompensationEarning(
        ApiTestData.WorkerInPharmacy1Id,
        Role.Admin,
        StaffCompensationSourceType.OrderReady,
        Guid.NewGuid(),
        25m,
        "TJS",
        ApiTestData.Pharmacy1Id));
      await db.SaveChangesAsync();
    }

    using var adminClient = await CreateAuthorizedClientAsync(TestActor.Worker1);
    var createResponse = await adminClient.PostAsJsonAsync("/api/staff-compensation/payout-requests", new
    {
      Bank = "DushanbeCity",
      WalletPhoneNumber = "+992900000888"
    });
    Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
    var createdJson = await ReadJsonAsync(createResponse);
    var requestId = createdJson.GetProperty("id").GetGuid();
    Assert.Equal("Worker One", createdJson.GetProperty("staffName").GetString());
    Assert.Equal("Pharmacy One", createdJson.GetProperty("pharmacyTitle").GetString());
    Assert.Equal(25m, createdJson.GetProperty("amount").GetDecimal());
    Assert.Contains("dushanbecity://", createdJson.GetProperty("deepLinkUrl").GetString());

    var reservedResponse = await adminClient.GetAsync("/api/staff-compensation/me");
    Assert.Equal(HttpStatusCode.OK, reservedResponse.StatusCode);
    var reservedJson = await ReadJsonAsync(reservedResponse);
    Assert.Equal(25m, reservedJson.GetProperty("summary").GetProperty("pendingPayoutAmount").GetDecimal());
    Assert.Equal(0m, reservedJson.GetProperty("summary").GetProperty("balanceAmount").GetDecimal());

    using var superAdminClient = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var listResponse = await superAdminClient.GetAsync("/api/staff-compensation/payout-requests");
    Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
    var listJson = await ReadJsonAsync(listResponse);
    Assert.Contains(listJson.GetProperty("payoutRequests").EnumerateArray(), item => item.GetProperty("id").GetGuid() == requestId);

    using var form = new MultipartFormDataContent();
    form.Add(new StringContent("salary paid"), "note");
    var receipt = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
    receipt.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
    form.Add(receipt, "receipt", "salary.png");
    var completeResponse = await superAdminClient.PostAsync(
      $"/api/staff-compensation/payout-requests/{requestId}/complete",
      form);
    Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);
    var completedJson = await ReadJsonAsync(completeResponse);
    Assert.Equal("Completed", completedJson.GetProperty("status").GetString());
    Assert.Equal("salary paid", completedJson.GetProperty("note").GetString());
    Assert.False(string.IsNullOrWhiteSpace(completedJson.GetProperty("receiptImageUrl").GetString()));

    var finalResponse = await adminClient.GetAsync("/api/staff-compensation/me");
    Assert.Equal(HttpStatusCode.OK, finalResponse.StatusCode);
    var finalJson = await ReadJsonAsync(finalResponse);
    Assert.Equal(25m, finalJson.GetProperty("summary").GetProperty("paidAmount").GetDecimal());
    Assert.Equal(0m, finalJson.GetProperty("summary").GetProperty("pendingPayoutAmount").GetDecimal());
    Assert.Equal(0m, finalJson.GetProperty("summary").GetProperty("balanceAmount").GetDecimal());

    using (var scope = Factory.CreateScope())
    {
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      Assert.True(await db.StaffCompensationPayouts.AnyAsync(x => x.StaffUserId == ApiTestData.WorkerInPharmacy1Id && x.Amount == 25m));
    }
  }
}
