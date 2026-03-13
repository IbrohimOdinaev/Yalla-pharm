using Yalla.Api.IntegrationTests.Fixtures;

namespace Yalla.Api.IntegrationTests.Scenarios.ReferenceData;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class UserCrudSmokeTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    [Trait("Category", "Smoke")]
    public async Task UserCrud_ShouldCreateReadUpdateDelete()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string email = "integration.user@yalla.test";

        var createRequest = new
        {
            firstName = "Integration",
            lastName = "User",
            phoneNumber = "+992900000001",
            role = 2,
            email,
            password = "Password123"
        };

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/user", createRequest);
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        HttpResponseMessage getUsersResponse = await client.GetAsync("/user");
        Assert.Equal(HttpStatusCode.OK, getUsersResponse.StatusCode);

        Guid createdUserId = await ExtractUserIdByEmailAsync(getUsersResponse, email);

        var updateRequest = new
        {
            id = createdUserId,
            firstName = "Updated",
            lastName = "User",
            phoneNumber = "+992900000001",
            role = 4,
            email,
            password = "Password123"
        };

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync("/user/update", updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        HttpResponseMessage getUpdatedUserResponse = await client.GetAsync($"/user/{createdUserId}");
        Assert.Equal(HttpStatusCode.OK, getUpdatedUserResponse.StatusCode);

        using JsonDocument updatedUserDocument = JsonDocument.Parse(await getUpdatedUserResponse.Content.ReadAsStringAsync());
        Assert.Equal("Updated", updatedUserDocument.RootElement.GetProperty("firstName").GetString());

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"/user/{createdUserId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        HttpResponseMessage getDeletedUserResponse = await client.GetAsync($"/user/{createdUserId}");
        Assert.Equal(HttpStatusCode.NotFound, getDeletedUserResponse.StatusCode);
    }

    [Fact]
    public async Task UserDelete_ShouldBeIdempotent()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        var createRequest = new
        {
            firstName = "Delete",
            lastName = "Idempotent",
            phoneNumber = "+992900000002",
            role = 2,
            email = "idempotent.user@yalla.test",
            password = "Password123"
        };

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/user", createRequest);
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        HttpResponseMessage usersResponse = await client.GetAsync("/user");
        Guid createdUserId = await ExtractUserIdByEmailAsync(usersResponse, "idempotent.user@yalla.test");

        HttpResponseMessage firstDelete = await client.DeleteAsync($"/user/{createdUserId}");
        HttpResponseMessage secondDelete = await client.DeleteAsync($"/user/{createdUserId}");

        Assert.Equal(HttpStatusCode.OK, firstDelete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, secondDelete.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<Guid> ExtractUserIdByEmailAsync(HttpResponseMessage response, string expectedEmail)
    {
        string payload = await response.Content.ReadAsStringAsync();
        using JsonDocument document = JsonDocument.Parse(payload);

        JsonElement userElement = document.RootElement
            .EnumerateArray()
            .Single(user => string.Equals(
                user.GetProperty("email").GetString(),
                expectedEmail,
                StringComparison.OrdinalIgnoreCase));

        return userElement.GetProperty("id").GetGuid();
    }
}
