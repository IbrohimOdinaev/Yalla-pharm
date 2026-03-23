using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Api.IntegrationTests.TestData;

namespace Yalla.Api.IntegrationTests.Scenarios.ReferenceData;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class PaymentMethodCrudFullTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    public async Task PaymentMethodCrud_ShouldCreateReadDelete()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string originalName = "Card";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/paymentMethod", new
        {
            name = originalName
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.True(await createResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listAfterCreate = await client.GetAsync("/api/paymentMethod");
        Assert.Equal(HttpStatusCode.OK, listAfterCreate.StatusCode);
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listAfterCreate, originalName);

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"/api/paymentMethod/{createdId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.True(await deleteResponse.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task PaymentMethod_Update_ShouldReturnOk_AndPersistChanges()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string originalName = "Card";
        string updatedName = "Card Updated";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/paymentMethod", new
        {
            name = originalName
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        HttpResponseMessage listAfterCreate = await client.GetAsync("/api/paymentMethod");
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listAfterCreate, originalName);

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync("/api/paymentMethod/update", new
        {
            id = createdId,
            name = updatedName
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(await updateResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listAfterUpdate = await client.GetAsync("/api/paymentMethod");
        Assert.Equal(HttpStatusCode.OK, listAfterUpdate.StatusCode);
        Assert.True(await JsonTestHelpers.ListContainsNameAsync(listAfterUpdate, updatedName));
        Assert.False(await JsonTestHelpers.ListContainsNameAsync(listAfterUpdate, originalName));
    }

    [Fact]
    public async Task PaymentMethod_CreateWithEmptyName_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/paymentMethod", new
        {
            name = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PaymentMethod_GetByEmptyId_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.GetAsync($"/api/paymentMethod/{Guid.Empty}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
