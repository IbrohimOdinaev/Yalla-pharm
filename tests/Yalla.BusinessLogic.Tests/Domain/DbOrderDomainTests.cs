namespace Yalla.BusinessLogic.Tests.Domain;

public sealed class DbOrderDomainTests
{
    [Fact]
    public void Should_GenerateNewId_When_IdIsEmpty()
    {
        DbOrder order = new()
        {
            Id = string.Empty,
        };

        Assert.False(string.IsNullOrWhiteSpace(order.Id));
    }

    [Fact]
    public void Should_KeepProvidedId_When_IdIsSpecified()
    {
        DbOrder order = new()
        {
            Id = Guid.NewGuid(),
        };

        Assert.Equal("order-domain-1", order.Id);
    }

    [Fact]
    public void Should_InitializeAggregate_When_OrderIsCreated()
    {
        DbOrder order = new();

        Assert.NotNull(order.OrderHistory);
        Assert.NotNull(order.Client);
        Assert.NotNull(order.PharmacyOrders);
    }

    [Fact]
    public void Should_UpdateCalculatedAmounts_When_ValuesAreReassigned()
    {
        DbOrder order = new()
        {
            AmountWithMarkup = 500m,
            AmountWithDelivery = 530m,
            AmountWithDiscount = 510m,
            RemainingPayment = 300m,
        };

        order.AmountWithMarkup = 450m;
        order.AmountWithDelivery = 470m;
        order.AmountWithDiscount = 460m;
        order.RemainingPayment = 250m;

        Assert.Equal(450m, order.AmountWithMarkup);
        Assert.Equal(470m, order.AmountWithDelivery);
        Assert.Equal(460m, order.AmountWithDiscount);
        Assert.Equal(250m, order.RemainingPayment);
    }

    [Fact]
    public void Should_SetReturnedState_When_OrderHistoryStateChangesToReturned()
    {
        DbOrder order = new()
        {
            OrderHistory = new DbOrderHistory
            {
                State = OrderState.Delivered,
                PastState = OrderState.Placed,
            }
        };

        order.OrderHistory.State = OrderState.Returned;
        order.OrderHistory.PastState = OrderState.Delivered;

        Assert.Equal(OrderState.Returned, order.OrderHistory.State);
        Assert.Equal(OrderState.Delivered, order.OrderHistory.PastState);
    }
}
