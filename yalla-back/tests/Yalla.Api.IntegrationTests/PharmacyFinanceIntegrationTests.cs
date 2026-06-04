using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class PharmacyFinanceIntegrationTests : ApiTestBase
{
  public PharmacyFinanceIntegrationTests(ApiWebApplicationFactory factory) : base(factory)
  {
  }

  [Fact]
  public async Task PharmacyWithdrawal_AdminCreatesAndSuperAdminCompletes_ShouldPersistHistoryWithReceipt()
  {
    using (var scope = Factory.CreateScope())
    {
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var order = await db.Orders.FirstAsync(x => x.Id == ApiTestData.OrderOnTheWayId);
      order.NextStage(true);
      await db.SaveChangesAsync();
    }

    using var adminClient = await CreateAuthorizedClientAsync(TestActor.Admin1);
    var summaryResponse = await adminClient.GetAsync("/api/pharmacy-finance/admin");
    Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
    var summaryJson = await ReadJsonAsync(summaryResponse);
    Assert.Equal(10m, summaryJson.GetProperty("summary").GetProperty("availableAmount").GetDecimal());

    var createResponse = await adminClient.PostAsJsonAsync("/api/pharmacy-finance/admin/withdrawals", new
    {
      Bank = "Eskhata",
      WalletPhoneNumber = "+992900000777"
    });
    Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
    var createdJson = await ReadJsonAsync(createResponse);
    var withdrawalId = createdJson.GetProperty("id").GetGuid();
    Assert.Equal("Pharmacy One", createdJson.GetProperty("pharmacyTitle").GetString());
    Assert.Equal("Admin One", createdJson.GetProperty("requestedByAdminName").GetString());
    Assert.Contains("eskhata://", createdJson.GetProperty("deepLinkUrl").GetString());

    using var superAdminClient = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var listResponse = await superAdminClient.GetAsync("/api/pharmacy-finance/superadmin/withdrawals");
    Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
    var listJson = await ReadJsonAsync(listResponse);
    Assert.Contains(listJson.GetProperty("withdrawalRequests").EnumerateArray(), item => item.GetProperty("id").GetGuid() == withdrawalId);

    using var form = new MultipartFormDataContent();
    form.Add(new StringContent("paid from mobile app"), "comment");
    var receipt = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
    receipt.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
    form.Add(receipt, "receipt", "receipt.png");
    var completeResponse = await superAdminClient.PostAsync(
      $"/api/pharmacy-finance/superadmin/withdrawals/{withdrawalId}/complete",
      form);
    Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);
    var completedJson = await ReadJsonAsync(completeResponse);
    Assert.Equal((int)PharmacyWithdrawalStatus.Completed, completedJson.GetProperty("status").GetInt32());
    Assert.Equal("paid from mobile app", completedJson.GetProperty("superAdminComment").GetString());
    Assert.False(string.IsNullOrWhiteSpace(completedJson.GetProperty("receiptImageUrl").GetString()));

    var receiptResponse = await superAdminClient.GetAsync($"/api/pharmacy-finance/withdrawals/{withdrawalId}/receipt/content");
    Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
    Assert.Equal("image/png", receiptResponse.Content.Headers.ContentType?.MediaType);
  }
}
