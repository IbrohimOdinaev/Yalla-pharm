using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Api.IntegrationTests.TestData;

namespace Yalla.Api.IntegrationTests.Scenarios.ReferenceData;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class NamedReferenceDataCrudFullTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Theory]
    [InlineData("/api/packagingType", "PackagingType")]
    [InlineData("/api/packagingUnit", "PackagingUnit")]
    [InlineData("/api/releaseForm", "ReleaseForm")]
    public async Task NamedReferenceCrud_ShouldCreateReadDelete(string route, string namePrefix)
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string originalName = $"{namePrefix}-Original";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync(route, new
        {
            name = originalName
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.True(await createResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listAfterCreate = await client.GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, listAfterCreate.StatusCode);
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listAfterCreate, originalName);

        HttpResponseMessage getByIdResponse = await client.GetAsync($"{route}/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getByIdResponse.StatusCode);
        using (JsonDocument getByIdDocument = JsonDocument.Parse(await getByIdResponse.Content.ReadAsStringAsync()))
        {
            Assert.Equal(originalName, getByIdDocument.RootElement.GetProperty("name").GetString());
        }

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"{route}/{createdId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.True(await deleteResponse.Content.ReadFromJsonAsync<bool>());
    }

    [Theory]
    [InlineData("/api/packagingType", "PackagingType")]
    [InlineData("/api/packagingUnit", "PackagingUnit")]
    [InlineData("/api/releaseForm", "ReleaseForm")]
    public async Task NamedReference_Update_ShouldReturnOk_AndPersistChanges(string route, string namePrefix)
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string originalName = $"{namePrefix}-Original";
        string updatedName = $"{namePrefix}-Updated";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync(route, new
        {
            name = originalName
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        HttpResponseMessage listAfterCreate = await client.GetAsync(route);
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listAfterCreate, originalName);

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync($"{route}/update", new
        {
            id = createdId,
            name = updatedName
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(await updateResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listAfterUpdate = await client.GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, listAfterUpdate.StatusCode);
        Assert.True(await JsonTestHelpers.ListContainsNameAsync(listAfterUpdate, updatedName));
        Assert.False(await JsonTestHelpers.ListContainsNameAsync(listAfterUpdate, originalName));
    }

    [Theory]
    [InlineData("/api/packagingType")]
    [InlineData("/api/packagingUnit")]
    [InlineData("/api/releaseForm")]
    public async Task NamedReference_CreateWithEmptyName_ShouldReturnBadRequest(string route)
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.PostAsJsonAsync(route, new
        {
            name = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/packagingType")]
    [InlineData("/api/packagingUnit")]
    [InlineData("/api/releaseForm")]
    public async Task NamedReference_GetByEmptyId_ShouldReturnBadRequest(string route)
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.GetAsync($"{route}/{Guid.Empty}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
