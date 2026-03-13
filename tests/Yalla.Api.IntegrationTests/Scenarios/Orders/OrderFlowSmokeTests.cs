using Microsoft.EntityFrameworkCore;
using Yalla.Application;
using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Api.IntegrationTests.TestData;
using Yalla.Infrastructure;
using Yalla.Domain.Enums;

namespace Yalla.Api.IntegrationTests.Scenarios.Orders;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class OrderFlowSmokeTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    [Trait("Category", "Smoke")]
    public async Task OrderFlow_ShouldCreateTransitionAndPersistHistory()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        Guid orderId = TestGuids.OrderId;
        DateTime now = new(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);

        await SeedOrderAsync(orderId, now);

        var rejectionRequest = new
        {
            orderId,
            state = 13,
            reasonForOrderRejection = "Integration rejection",
            comment = "state changed by integration test",
            timeOfCompletionOfInquiry = now.AddMinutes(3),
            amountOfProcessingTime = 0
        };

        HttpResponseMessage rejectionResponse = await client.PostAsJsonAsync($"/api/orders/rejection/{orderId}", rejectionRequest);
        Assert.Equal(HttpStatusCode.OK, rejectionResponse.StatusCode);

        bool rejectionResult = await rejectionResponse.Content.ReadFromJsonAsync<bool>();
        Assert.True(rejectionResult);

        HttpResponseMessage byStateResponse = await client.GetAsync($"/api/orders/{orderId}/Rejection");
        Assert.Equal(HttpStatusCode.OK, byStateResponse.StatusCode);

        string byStatePayload = await byStateResponse.Content.ReadAsStringAsync();
        Assert.Contains("Integration rejection", byStatePayload);

        using IServiceScope scope = fixture.Factory.Services.CreateScope();
        YallaDbContext dbContext = scope.ServiceProvider.GetRequiredService<YallaDbContext>();

        var orderHistory = await dbContext.OrderHistories
            .AsNoTracking()
            .SingleAsync(history => history.OrderId == orderId);

        Assert.Equal(OrderState.Rejection, orderHistory.State);
        Assert.Equal(OrderState.Application, orderHistory.PastState);
    }

    [Fact]
    public async Task OrderRejection_WhenRouteAndBodyIdsMismatch_ShouldReturnBadRequest()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        Guid routeOrderId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        Guid bodyOrderId = Guid.Parse("44444444-4444-4444-4444-444444444444");

        var rejectionRequest = new
        {
            orderId = bodyOrderId,
            state = 13,
            reasonForOrderRejection = "Invalid payload",
            comment = "ids mismatch",
            timeOfCompletionOfInquiry = new DateTime(2026, 1, 15, 11, 0, 0, DateTimeKind.Utc),
            amountOfProcessingTime = 0
        };

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/orders/rejection/{routeOrderId}", rejectionRequest);

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
            OrderNumber = "IT-ORDER-0001",
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
