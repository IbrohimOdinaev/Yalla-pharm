using Microsoft.Data.Sqlite;
using Yalla.DataAccess.Tests.TestInfrastructure;

namespace Yalla.DataAccess.Tests.Repositories;

public sealed class OrderRepositorySqliteTests
{
    [Fact]
    public async Task Should_ReturnFullObjectGraph_When_GetOrderWithPharmacyOrdersIsCalled()
    {
        (YallaDbContext context, SqliteConnection connection) = SqliteDbContextFactory.Create();
        await using (context)
        using (connection)
        {
            DbOrder seededOrder = DataAccessTestDataFactory.CreateOrderAggregate(
                orderId: "order-graph-1",
                orderNumber: "ORD-GRAPH-1",
                state: OrderState.Placed,
                createdAt: DateTime.Now.AddHours(-2),
                clientPhone: "+992900000111",
                clientName: "Graph Client");

            context.Orders.Add(seededOrder);
            await context.SaveChangesAsync();

            OrderRepository repository = new(context);

            DbOrder? result = await repository.GetOrderWithPharmacyOrders(seededOrder.Id);

            Assert.NotNull(result);
            Assert.NotNull(result!.OrderHistory);
            Assert.NotNull(result.Client);
            Assert.NotNull(result.Client.Addresses);
            Assert.Single(result.Client.Addresses!);
            Assert.NotNull(result.PharmacyOrders);
            Assert.Single(result.PharmacyOrders);

            DbPharmacyOrder pharmacyOrder = result.PharmacyOrders[0];
            Assert.NotNull(pharmacyOrder.Pharmacy);
            Assert.NotNull(pharmacyOrder.ProductsHistories);
            Assert.Single(pharmacyOrder.ProductsHistories);

            DbProductHistory productHistory = pharmacyOrder.ProductsHistories[0];
            Assert.NotNull(productHistory.Product);
            Assert.NotNull(productHistory.Product.ProductProvider);
            Assert.Equal(
                seededOrder.PharmacyOrders[0].ProductsHistories[0].Product.ProductProvider.Id,
                productHistory.Product.ProductProvider.Id);
        }
    }

    [Fact]
    public async Task Should_ReturnOrderGraph_When_GetByStateAsyncWithOrderIdIsCalled()
    {
        (YallaDbContext context, SqliteConnection connection) = SqliteDbContextFactory.Create();
        await using (context)
        using (connection)
        {
            DbOrder matchingOrder = DataAccessTestDataFactory.CreateOrderAggregate(
                orderId: "order-by-state-id-1",
                orderNumber: "ORD-BY-STATE-ID-1",
                state: OrderState.Placed,
                createdAt: DateTime.Now.AddHours(-1),
                clientPhone: "+992900001111",
                clientName: "Match Client");

            DbOrder wrongStateOrder = DataAccessTestDataFactory.CreateOrderAggregate(
                orderId: "order-by-state-id-2",
                orderNumber: "ORD-BY-STATE-ID-2",
                state: OrderState.Delivered,
                createdAt: DateTime.Now.AddHours(-1),
                clientPhone: "+992900002222",
                clientName: "Wrong State Client");

            context.Orders.AddRange(matchingOrder, wrongStateOrder);
            await context.SaveChangesAsync();

            OrderRepository repository = new(context);
            DbOrder? result = await repository.GetByStateAsync(OrderState.Placed, matchingOrder.Id);

            Assert.NotNull(result);
            Assert.Equal(matchingOrder.Id, result!.Id);
            Assert.NotNull(result.Client);
            Assert.NotNull(result.OrderHistory);
            Assert.NotNull(result.PharmacyOrders);
            Assert.NotEmpty(result.PharmacyOrders);
            Assert.NotEmpty(result.PharmacyOrders[0].ProductsHistories);
            Assert.NotNull(result.PharmacyOrders[0].ProductsHistories[0].Product);
            Assert.NotNull(result.PharmacyOrders[0].ProductsHistories[0].Product.ProductProvider);
        }
    }

    [Fact]
    public async Task Should_ReturnNull_When_GetByStateAsyncWithOrderIdDoesNotMatchState()
    {
        (YallaDbContext context, SqliteConnection connection) = SqliteDbContextFactory.Create();
        await using (context)
        using (connection)
        {
            DbOrder order = DataAccessTestDataFactory.CreateOrderAggregate(
                orderId: "order-state-mismatch-1",
                orderNumber: "ORD-STATE-MISMATCH-1",
                state: OrderState.Placed,
                createdAt: DateTime.Now.AddHours(-2),
                clientPhone: "+992900005555",
                clientName: "State Mismatch Client");

            context.Orders.Add(order);
            await context.SaveChangesAsync();

            OrderRepository repository = new(context);
            DbOrder? result = await repository.GetByStateAsync(OrderState.Delivered, order.Id);

            Assert.Null(result);
        }
    }
}
