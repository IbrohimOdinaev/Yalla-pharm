using Yalla.BusinessLogic.Tests.TestInfrastructure;
using System.Globalization;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class OrderServiceTests
{
    private static OrderService CreateService(
        Mock<IOrderRepository>? orderRepositoryMock = null,
        Mock<IOrderHistoryRepository>? orderHistoryRepositoryMock = null,
        Mock<IClientRepository>? clientRepositoryMock = null,
        Mock<IPharmacyRepository>? pharmacyRepositoryMock = null,
        Mock<IMessageService>? messageServiceMock = null,
        Mock<ITelegramService>? telegramServiceMock = null,
        Mock<IDeliveryService>? deliveryServiceMock = null)
    {
        return new OrderService(
            (orderRepositoryMock ?? new Mock<IOrderRepository>()).Object,
            (orderHistoryRepositoryMock ?? new Mock<IOrderHistoryRepository>()).Object,
            (clientRepositoryMock ?? new Mock<IClientRepository>()).Object,
            (pharmacyRepositoryMock ?? new Mock<IPharmacyRepository>()).Object,
            (messageServiceMock ?? new Mock<IMessageService>()).Object,
            (telegramServiceMock ?? new Mock<ITelegramService>()).Object,
            (deliveryServiceMock ?? new Mock<IDeliveryService>()).Object);
    }

    [Fact]
    public async Task DeleteAsync_WhenOrderExists_ShouldDeleteHistoryThenOrder()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        Mock<IOrderHistoryRepository> orderHistoryRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        orderHistoryRepositoryMock
            .Setup(x => x.DeleteByOrderIdAsync("order-1", cancellationToken))
            .ReturnsAsync(true);

        orderRepositoryMock
            .Setup(x => x.DeleteAsync("order-1", cancellationToken))
            .ReturnsAsync(true);

        OrderService service = CreateService(
            orderRepositoryMock,
            orderHistoryRepositoryMock);

        bool result = await service.DeleteAsync("order-1", cancellationToken);

        Assert.True(result);
        orderHistoryRepositoryMock.Verify(x => x.DeleteByOrderIdAsync("order-1", cancellationToken), Times.Once);
        orderRepositoryMock.Verify(x => x.DeleteAsync("order-1", cancellationToken), Times.Once);
    }

    [Fact]
    public async Task InSearchAsync_WhenOrderNotFound_ShouldReturnFalse()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        orderRepositoryMock
            .Setup(x => x.GetOrderWithPharmacyOrders("order-1", cancellationToken))
            .ReturnsAsync((DbOrder?)null);

        OrderService service = CreateService(orderRepositoryMock: orderRepositoryMock);

        bool result = await service.InSearchAsync("order-1", new OrderInSearchRequest(), cancellationToken);

        Assert.False(result);
        orderRepositoryMock.Verify(x => x.GetOrderWithPharmacyOrders("order-1", cancellationToken), Times.Once);
    }

    [Fact]
    public async Task WaitingClientAsync_WhenOrderNotFound_ShouldReturnFalse()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        orderRepositoryMock
            .Setup(x => x.GetAsNoTrackingAsync("order-1", cancellationToken))
            .ReturnsAsync((DbOrder?)null);

        OrderService service = CreateService(orderRepositoryMock: orderRepositoryMock);

        bool result = await service.WaitingClientAsync("order-1", new OrderWaitClientRequest(), cancellationToken);

        Assert.False(result);
        orderRepositoryMock.Verify(x => x.GetAsNoTrackingAsync("order-1", cancellationToken), Times.Once);
    }

    [Fact]
    public async Task PlacementAsync_WhenOrderNotFound_ShouldReturnFalse()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        orderRepositoryMock
            .Setup(x => x.GetOrderWithPharmacyOrders("order-1", cancellationToken))
            .ReturnsAsync((DbOrder?)null);

        OrderService service = CreateService(orderRepositoryMock: orderRepositoryMock);

        bool result = await service.PlacementAsync("order-1", new OrderPlacementRequest(), cancellationToken);

        Assert.False(result);
        orderRepositoryMock.Verify(x => x.GetOrderWithPharmacyOrders("order-1", cancellationToken), Times.Once);
    }

    [Fact]
    public async Task ConsultingAsync_WhenOrderIsNew_ShouldGenerateOrderNumberAndMapClientData()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        Mock<IClientRepository> clientRepositoryMock = new();
        Mock<IPharmacyRepository> pharmacyRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        OrderConsultingRequest orderConsulting = new()
        {
            OrderId = "order-new-1",
            Operator = "Operator A",
            ClientPhoneNumber = "+992900000001",
            ClientFullName = "Client from consulting",
            SocialUsername = "@consulting_client",
            ContactType = ContactType.WhatsApp,
            Language = Language.Tj,
            Gender = Gender.Female,
            TypeOfClient = TypeOfClient.People,
            Comment = "New order",
            OrderType = OrderType.AmateurMedicine,
            ComesFrom = OrderComesFrom.WhatsApp,
            CreatedAt = new DateTime(2026, 1, 12, 10, 30, 0),
            TimeForAcceptingRequest = new DateTime(2026, 1, 12, 10, 45, 0),
            RequestDate = new DateTime(2026, 1, 12, 10, 35, 0),
            IsContinue = true,
            PharmacyOrders = new List<PharmacyOrderResponse>
            {
                TestDataFactory.CreatePharmacyOrderDtoDetailed(
                    "pharmacy-order-consulting",
                    "pharmacy-1",
                    TestDataFactory.CreateProductHistoryDtoDetailed("history-consulting-1", 2, 100m, 90m, arrivalDate: "2026-01-12"),
                    TestDataFactory.CreateProductHistoryDtoDetailed("history-consulting-2", 1, 50m, 40m, arrivalDate: "2026-01-13")),
            },
        };

        DbClient existingClient = TestDataFactory.CreateDbClient() with
        {
            Id = Guid.NewGuid(),
            FullName = "Old client",
            PhoneNumber = orderConsulting.ClientPhoneNumber,
            SocialUsername = orderConsulting.SocialUsername,
        };

        DbPharmacy dbPharmacy = TestDataFactory.CreateDbPharmacy() with
        {
            Id = Guid.NewGuid(),
            Name = "Stored Pharmacy",
        };

        DbOrder? capturedOrder = null;
        OrderState capturedPastState = OrderState.Undefined;

        clientRepositoryMock
            .Setup(x => x.GetByPhoneNumber(orderConsulting.ClientPhoneNumber, orderConsulting.SocialUsername, cancellationToken))
            .ReturnsAsync(existingClient);

        orderRepositoryMock
            .Setup(x => x.GetOrderWithPharmacyOrders(orderConsulting.OrderId, cancellationToken))
            .ReturnsAsync((DbOrder?)null);

        pharmacyRepositoryMock
            .Setup(x => x.GetAsync("pharmacy-1", cancellationToken))
            .ReturnsAsync(dbPharmacy);

        orderRepositoryMock
            .Setup(x => x.ConsultingAsync(It.IsAny<DbOrder>(), It.IsAny<OrderState>(), cancellationToken))
            .Callback<DbOrder, OrderState, CancellationToken>((order, pastState, _) =>
            {
                capturedOrder = order;
                capturedPastState = pastState;
            })
            .ReturnsAsync((true, "created-order-id"));

        OrderService service = CreateService(
            orderRepositoryMock: orderRepositoryMock,
            clientRepositoryMock: clientRepositoryMock,
            pharmacyRepositoryMock: pharmacyRepositoryMock);

        (bool result, string orderId) = await service.ConsultingAsync(orderConsulting, cancellationToken);

        Assert.True(result);
        Assert.Equal("created-order-id", orderId);
        Assert.NotNull(capturedOrder);
        Assert.Equal(orderConsulting.OrderId, capturedOrder!.Id);
        Assert.Equal(existingClient.Id, capturedOrder.Client.Id);
        Assert.Equal(orderConsulting.ClientFullName, capturedOrder.Client.FullName);
        Assert.Equal(orderConsulting.ClientPhoneNumber, capturedOrder.Client.PhoneNumber);
        Assert.Equal(orderConsulting.SocialUsername, capturedOrder.Client.SocialUsername);
        Assert.Equal(orderConsulting.ContactType, capturedOrder.Client.ContactType);
        Assert.Equal(OrderState.InSearch, capturedOrder.OrderHistory.State);
        Assert.Equal(OrderState.Application, capturedOrder.OrderHistory.PastState);
        Assert.Equal(OrderState.Application, capturedPastState);
        Assert.Equal("Stored Pharmacy", capturedOrder.PharmacyOrders[0].Pharmacy.Name);
        Assert.Equal(250m, capturedOrder.AmountWithMarkup);
        Assert.Equal(220m, capturedOrder.AmountWithoutMarkup);

        string dayPrefix = DateTime.Now.Day.ToString(CultureInfo.InvariantCulture);
        string monthYearSuffix = DateTime.Now.Month.ToString(CultureInfo.InvariantCulture)
            + (DateTime.Now.Year % 1000).ToString(CultureInfo.InvariantCulture);
        Assert.StartsWith(dayPrefix, capturedOrder.OrderNumber);
        Assert.EndsWith(monthYearSuffix, capturedOrder.OrderNumber);
    }

    [Fact]
    public async Task ConsultingAsync_WhenContinuingExistingOrder_ShouldKeepOrderNumberAndUpdateClientData()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        Mock<IClientRepository> clientRepositoryMock = new();
        Mock<IPharmacyRepository> pharmacyRepositoryMock = new();
        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        DbPharmacy dbPharmacy = TestDataFactory.CreateDbPharmacy() with
        {
            Id = Guid.NewGuid(),
            Name = "Existing pharmacy",
        };

        DbOrder existingOrder = TestDataFactory.CreateDbOrderWithStructure(
            OrderState.Application,
            new[]
            {
                TestDataFactory.CreateDbPharmacyOrderDetailed(
                    "pharmacy-order-existing",
                    "pharmacy-1",
                    dbPharmacy,
                    TestDataFactory.CreateDbProductHistoryDetailed("history-existing-1", 1, 120m, 100m)),
            }) with
        {
            Id = Guid.NewGuid(),
            OrderNumber = "EXIST-2026",
            Client = TestDataFactory.CreateDbClient() with
            {
                Id = Guid.NewGuid(),
                FullName = "Client before update",
            },
            OrderHistory = TestDataFactory.CreateDbOrderHistory(OrderState.Application) with
            {
                Id = Guid.NewGuid(),
                State = OrderState.Application,
            },
        };

        OrderConsultingRequest orderConsulting = new()
        {
            OrderId = existingOrder.Id,
            Operator = "Operator B",
            ClientPhoneNumber = "+992900000099",
            ClientFullName = "Updated client",
            SocialUsername = "@updated_client",
            ContactType = ContactType.Telegram,
            Language = Language.Ru,
            Gender = Gender.Male,
            TypeOfClient = TypeOfClient.Company,
            Comment = "Continue existing order",
            OrderType = OrderType.Prescription,
            ComesFrom = OrderComesFrom.Telegram,
            CreatedAt = new DateTime(2026, 1, 13, 8, 0, 0),
            TimeForAcceptingRequest = new DateTime(2026, 1, 13, 8, 5, 0),
            RequestDate = new DateTime(2026, 1, 13, 8, 2, 0),
            IsContinue = true,
            PharmacyOrders = new List<PharmacyOrderResponse>
            {
                TestDataFactory.CreatePharmacyOrderDtoDetailed(
                    "pharmacy-order-existing",
                    "pharmacy-1",
                    TestDataFactory.CreateProductHistoryDtoDetailed("history-existing-1", 1, 120m, 100m, arrivalDate: "2026-01-14")),
            },
        };

        DbOrder? capturedOrder = null;
        OrderState capturedPastState = OrderState.Undefined;

        clientRepositoryMock
