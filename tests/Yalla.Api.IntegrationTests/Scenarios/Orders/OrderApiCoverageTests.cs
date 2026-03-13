using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Application;
using Yalla.Api.IntegrationTests.TestData;
using Yalla.Domain.Enums;

namespace Yalla.Api.IntegrationTests.Scenarios.Orders;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class OrderApiCoverageTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    public async Task OrderConsulting_AndQueryEndpoints_ShouldReturnOk()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        Guid orderId = TestGuids.OrderId;
        DateTime now = new(2026, 1, 20, 12, 0, 0, DateTimeKind.Utc);
        await SeedOrderAsync(orderId, now);

        HttpResponseMessage consultingResponse = await client.PostAsJsonAsync("/api/orders/consulting", new
        {
            orderId,
            orderNumber = $"IT-{orderId.ToString("N")[..8]}",
            @operator = "integration-operator",
            clientPhoneNumber = "+992900000010",
            clientFullName = "Integration Client",
            comment = "consulting created by integration test",
            isContinue = false,
            requestDate = now,
            createdAt = now,
            timeForAcceptingRequest = now,
            state = 1,
            orderType = 1,
            comesFrom = 1,
            language = 1,
            gender = 1,
            typeOfClient = 1,
            socialUsername = "",
            contactType = 1,
            takeIntoAccount = "",
            pharmacyOrders = Array.Empty<object>()
        });

        string consultingPayload = await consultingResponse.Content.ReadAsStringAsync();
        Assert.True(consultingResponse.StatusCode == HttpStatusCode.OK, consultingPayload);

        using JsonDocument consultingDoc = JsonDocument.Parse(consultingPayload);
        Assert.True(consultingDoc.RootElement.GetProperty("result").GetBoolean());
        Guid createdOrderId = consultingDoc.RootElement.GetProperty("orderId").GetGuid();
        Assert.Equal(orderId, createdOrderId);

        HttpResponseMessage orderNumberResponse = await client.GetAsync($"/api/orders/order-number/{createdOrderId}");
        Assert.Equal(HttpStatusCode.OK, orderNumberResponse.StatusCode);
        string orderNumber = await orderNumberResponse.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(orderNumber));

        HttpResponseMessage byStateGetResponse = await client.GetAsync($"/api/orders/by-state/{OrderState.Application}/10");
        Assert.Equal(HttpStatusCode.OK, byStateGetResponse.StatusCode);

        HttpResponseMessage byStatePostResponse = await client.PostAsJsonAsync("/api/orders/by-state", new
        {
            count = 10,
            state = 1,
            fromDate = now.AddDays(-1),
            toDate = now.AddDays(1),
            searchQuery = ""
        });
        Assert.Equal(HttpStatusCode.OK, byStatePostResponse.StatusCode);

        HttpResponseMessage pharmacyOrdersResponse = await client.GetAsync($"/api/orders/pharmacy-orders/{createdOrderId}");
        Assert.Equal(HttpStatusCode.OK, pharmacyOrdersResponse.StatusCode);
    }

    [Fact]
    public async Task OrderUpdateState_ShouldReturnOkTrue()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/orders/update-state", new
        {
            orderId = Guid.NewGuid(),
            state = 2,
            reasonForTheDelay = "Integration delay reason",
            courierName = "Courier-1"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await response.Content.ReadFromJsonAsync<bool>());
    }

    [Theory]
    [InlineData("insearch")]
    [InlineData("waiting-client")]
    [InlineData("placement")]
    [InlineData("delivered")]
    [InlineData("cancellation")]
    [InlineData("return-products")]
    public async Task OrderTransitions_WhenRouteAndBodyIdsMismatch_ShouldReturnBadRequest(string routeSegment)
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        Guid routeOrderId = Guid.NewGuid();
        Guid bodyOrderId = Guid.NewGuid();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/orders/{routeSegment}/{routeOrderId}", new
        {
            orderId = bodyOrderId
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task OrderReturnFromRejection_WithUnknownOrder_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.PostAsync($"/api/orders/return-from-rejection/{Guid.NewGuid()}", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task OrderConsulting_WithTooLongComment_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/orders/consulting", new
        {
            orderId = Guid.NewGuid(),
            comment = new string('x', 5001)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task SeedOrderAsync(Guid orderId, DateTime referenceTime)
    {
        using IServiceScope scope = fixture.Factory.Services.CreateScope();
        IOrderService orderService = scope.ServiceProvider.GetRequiredService<IOrderService>();

        OrderDto order = new()
        {
            Id = orderId,
            OrderNumber = "IT-ORDER-COVERAGE",
            Operator = "integration-operator",
            Type = OrderType.Prescription,
            ComesFrom = OrderComesFrom.Telegram,
            DeliveryType = DeliveryType.Standard,
            CityOrDistrict = "Dushanbe",
            CountryToDelivery = "Tajikistan",
            Comment = "seeded order",
            Discount = 0,
            Prepayment = 0,
            PriceForDeliveryOutsideTheCity = 0,
            TotalOrderAmountExcludingDelivery = 0,
            Client = new ClientDto
            {
                Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
                FullName = "Integration Client",
                PhoneNumber = "+992900000010",
                Street = "Rudaki 1",
                Landmark = "Center",
                GeolocationOfClientAddress = "0,0",
                Language = Language.Ru,
                Gender = Gender.Male,
                Type = TypeOfClient.People,
                ContactType = ContactType.Telegram
            },
            OrderHistory = new OrderHistoryDto
            {
                Id = Guid.Parse("66666666-6666-6666-6666-666666666666"),
                OrderId = orderId,
                CreatedAt = referenceTime,
                RequestDate = referenceTime,
                TimeForAcceptingRequest = referenceTime,
                State = OrderState.Application,
                PastState = OrderState.Application,
                PaymentStatus = PaymentStatus.NotPaid,
                PaymentMethod = "Cash"
            }
        };

        bool created = await orderService.CreateAsync(order);
        Assert.True(created);
    }
}
