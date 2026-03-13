using Yalla.Api.IntegrationTests.Fixtures;

namespace Yalla.Api.IntegrationTests.Scenarios.Orders;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class DeliveryControllerIntegrationTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    public async Task DeliverySend_ShouldReturnOkTrue()
    {
        using HttpClient client = fixture.CreateClient();

        HttpResponseMessage response = await client.PostAsync("/api/delivery/send", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await response.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task DeliveryUpdate_ShouldReturnOkTrue()
    {
        using HttpClient client = fixture.CreateClient();

        var request = new
        {
            orderId = Guid.Parse("88888888-8888-8888-8888-888888888888"),
            orderDetails = "Integration delivery details",
            state = 1
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/delivery/update", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await response.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task DeliveryUpdate_WithInvalidPayload_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/delivery/update", new
        {
            orderId = Guid.Empty
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;
}
