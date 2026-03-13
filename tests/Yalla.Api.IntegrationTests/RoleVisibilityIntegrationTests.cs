using System.Net;
using System.Net.Http.Json;
using Yalla.Api.IntegrationTests.TestInfrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class RoleVisibilityIntegrationTests : ApiTestBase
{
  public RoleVisibilityIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task Clients_List_AsAdmin_ShouldBeForbidden()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.GetAsync("/api/clients?page=1&pageSize=10");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Clients_List_AsSuperAdmin_ShouldReturnOk()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/clients?page=1&pageSize=10");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
  }

  [Fact]
  public async Task Clients_List_AsSuperAdmin_WithQuery_ShouldFilterByName()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/clients?page=1&pageSize=10&query=Client%20One");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var payload = await ReadJsonAsync(response);
    Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
    var clients = payload.GetProperty("clients").EnumerateArray().ToList();
    Assert.Single(clients);
    Assert.Equal("Client One", clients[0].GetProperty("name").GetString());
  }

  [Fact]
  public async Task Admins_List_AsSuperAdmin_WithQuery_ShouldFilterByName()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/admins?page=1&pageSize=10&query=Admin%20One");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var payload = await ReadJsonAsync(response);
    Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
    var admins = payload.GetProperty("admins").EnumerateArray().ToList();
    Assert.Single(admins);
    Assert.Equal("Admin One", admins[0].GetProperty("name").GetString());
  }

  [Fact]
  public async Task Pharmacies_List_AsSuperAdmin_WithQuery_ShouldFilterByAddress()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);

    var response = await client.GetAsync("/api/pharmacies/all?page=1&pageSize=10&query=Somoni");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var payload = await ReadJsonAsync(response);
    Assert.Equal(1, payload.GetProperty("totalCount").GetInt32());
    var pharmacies = payload.GetProperty("pharmacies").EnumerateArray().ToList();
    Assert.Single(pharmacies);
    Assert.Equal("Pharmacy Two", pharmacies[0].GetProperty("title").GetString());
  }

  [Fact]
  public async Task PharmacyWorkers_CreateDelete_AsAdmin_ShouldBeScopedToOwnPharmacy()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);
    var phone = $"91{Random.Shared.Next(1000000, 9999999)}";

    var createResponse = await client.PostAsJsonAsync("/api/pharmacy-workers", new
    {
      Name = "Worker Admin Scope",
      PhoneNumber = phone,
      Password = "Pass123!",
      PharmacyId = Guid.NewGuid()
    });
    Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

    var payload = await ReadJsonAsync(createResponse);
    var workerId = payload.GetProperty("pharmacyWorker").GetProperty("id").GetGuid();
    var pharmacyId = payload.GetProperty("pharmacyWorker").GetProperty("pharmacyId").GetGuid();
    Assert.Equal(ApiTestData.Pharmacy1Id, pharmacyId);

    var deleteResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/pharmacy-workers")
    {
      Content = JsonContent.Create(new
      {
        PharmacyWorkerId = workerId
      })
    });

    Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
  }
}
