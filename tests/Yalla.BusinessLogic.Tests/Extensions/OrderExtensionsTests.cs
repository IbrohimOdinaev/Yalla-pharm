using System.Globalization;
using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Extensions;

public sealed class OrderExtensionsTests
{
    [Fact]
    public void Should_MapAllFields_When_ConvertingDbOrderToOrderDto()
    {
        DbOrder dbOrder = TestDataFactory.CreateComplexDbOrder(OrderState.Placement) with
        {
            Id = Guid.NewGuid(),
            ClientId = "client-1",
            OrderNumber = "ORD-2026-001",
            Comment = "db-order-comment",
            CountryToDelivery = "Tajikistan",
            Courier = "Courier Z",
            CommentForCourier = "db-courier-comment",
            Operator = "Operator Z",
            TotalCost = 500m,
            Prepayment = 80m,
            RestPayment = 420m,
            TotalOrderAmountExcludingDelivery = 480m,
            CityOrDistrict = "Dushanbe",
            PriceForDeliveryOutsideTheCity = 25m,
            RemainingPayment = 390m,
            AmountWithDiscount = 460m,
            AmountWithMarkup = 480m,
            AmountWithoutMarkup = 430m,
            AmountWithDelivery = 505m,
            AmountWithoutDelivery = 480m,
            Type = OrderType.Prescription,
            ComesFrom = OrderComesFrom.Telegram,
            DeliveryType = DeliveryType.Comfort,
            DeliveredAt = new DateTime(2026, 1, 20, 17, 0, 0),
            OrderHistory = TestDataFactory.CreateDbOrderHistory(OrderState.Placed) with
            {
                Id = Guid.NewGuid(),
                OrderId = "order-map-db-1",
                Message = "history-message",
                PastState = OrderState.Placement,
                State = OrderState.Placed,
                PaymentStatus = PaymentStatus.PartiallyPaid,
                PaymentMethod = "Card",
                TimeForAcceptingRequest = new DateTime(2026, 1, 20, 10, 0, 0),
                TimeToObtainClientApproval = new DateTime(2026, 1, 20, 11, 0, 0),
                TimeToSendCheckToClient = new DateTime(2026, 1, 20, 11, 30, 0),
                TimeOfCompletionOfInquiry = new DateTime(2026, 1, 20, 12, 0, 0),
                DeliveredTime = new DateTime(2026, 1, 20, 18, 0, 0),
                ReturnedProductsCount = 1,
            },
        };

        OrderResponse orderDto = dbOrder.OrderToDto();

        Assert.Equal(dbOrder.Id, orderDto.Id);
        Assert.Equal(dbOrder.ClientId, orderDto.ClientId);
        Assert.Equal(dbOrder.OrderNumber, orderDto.OrderNumber);
        Assert.Equal(dbOrder.Comment, orderDto.Comment);
        Assert.Equal(dbOrder.CountryToDelivery, orderDto.CountryToDelivery);
        Assert.Equal(dbOrder.Courier, orderDto.Courier);
        Assert.Equal(dbOrder.CommentForCourier, orderDto.CommentForCourier);
        Assert.Equal(dbOrder.Operator, orderDto.Operator);
        Assert.Equal(dbOrder.TotalCost, orderDto.TotalCost);
        Assert.Equal(dbOrder.Prepayment, orderDto.Prepayment);
        Assert.Equal(dbOrder.RestPayment, orderDto.RestPayment);
        Assert.Equal(dbOrder.TotalOrderAmountExcludingDelivery, orderDto.TotalOrderAmountExcludingDelivery);
        Assert.Equal(dbOrder.CityOrDistrict, orderDto.CityOrDistrict);
        Assert.Equal(dbOrder.PriceForDeliveryOutsideTheCity, orderDto.PriceForDeliveryOutsideTheCity);
        Assert.Equal(dbOrder.RemainingPayment, orderDto.RemainingPayment);
        Assert.Equal(dbOrder.AmountWithDiscount, orderDto.AmountWithDiscount);
        Assert.Equal(dbOrder.AmountWithMarkup, orderDto.AmountWithMarkup);
        Assert.Equal(dbOrder.AmountWithoutMarkup, orderDto.AmountWithoutMarkup);
        Assert.Equal(dbOrder.AmountWithDelivery, orderDto.AmountWithDelivery);
        Assert.Equal(dbOrder.AmountWithoutDelivery, orderDto.AmountWithoutDelivery);
        Assert.Equal(dbOrder.Type, orderDto.Type);
        Assert.Equal(dbOrder.ComesFrom, orderDto.ComesFrom);
        Assert.Equal(dbOrder.DeliveryType, orderDto.DeliveryType);
        Assert.Equal(dbOrder.DeliveredAt, orderDto.DeliveredAt);

        Assert.Equal(dbOrder.OrderHistory.Id, orderDto.OrderHistory.Id);
        Assert.Equal(dbOrder.OrderHistory.OrderId, orderDto.OrderHistory.OrderId);
        Assert.Equal(dbOrder.OrderHistory.State, orderDto.OrderHistory.State);
        Assert.Equal(dbOrder.OrderHistory.PastState, orderDto.OrderHistory.PastState);
        Assert.Equal(dbOrder.OrderHistory.PaymentMethod, orderDto.OrderHistory.PaymentMethod);
        Assert.Equal(dbOrder.OrderHistory.PaymentStatus, orderDto.OrderHistory.PaymentStatus);
        Assert.Equal(dbOrder.OrderHistory.ReturnedProductsCount, orderDto.OrderHistory.ReturnedProductsCount);

        Assert.Equal(dbOrder.Client.FullName, orderDto.Client.FullName);
        Assert.Equal(dbOrder.Client.PhoneNumber, orderDto.Client.PhoneNumber);
        Assert.Equal(dbOrder.Client.SocialUsername, orderDto.Client.SocialUsername);
        Assert.Equal(dbOrder.Client.Addresses?.Count, orderDto.Client.Addresses?.Count);

        Assert.Equal(dbOrder.PharmacyOrders.Count, orderDto.PharmacyOrders.Count);
        foreach ((DbPharmacyOrder dbPharmacyOrder, PharmacyOrderResponse dtoPharmacyOrder) in dbOrder.PharmacyOrders.Zip(orderDto.PharmacyOrders))
        {
            Assert.Equal(dbPharmacyOrder.Id, dtoPharmacyOrder.Id);
            Assert.Equal(dbPharmacyOrder.OrderId, dtoPharmacyOrder.OrderId);
            Assert.Equal(dbPharmacyOrder.PharmacyId, dtoPharmacyOrder.PharmacyId);
            Assert.Equal(dbPharmacyOrder.Pharmacy.Name, dtoPharmacyOrder.Pharmacy.Name);
            Assert.Equal(dbPharmacyOrder.ProductsHistories.Count, dtoPharmacyOrder.ProductsHistories.Count);

            foreach ((DbProductHistory dbProductHistory, ProductHistoryResponse dtoProductHistory) in dbPharmacyOrder.ProductsHistories.Zip(dtoPharmacyOrder.ProductsHistories))
            {
                Assert.Equal(dbProductHistory.Id, dtoProductHistory.Id);
                Assert.Equal(dbProductHistory.Count, dtoProductHistory.Count);
                Assert.Equal(dbProductHistory.ReturnedCount, dtoProductHistory.ReturnedCount);
                Assert.Equal(dbProductHistory.AmountWithMarkup, dtoProductHistory.AmountWithMarkup);
                Assert.Equal(dbProductHistory.AmountWithoutMarkup, dtoProductHistory.AmountWithoutMarkup);
                Assert.Equal(dbProductHistory.ProductId, dtoProductHistory.ProductId);
                Assert.Equal(dbProductHistory.PharmacyOrderId, dtoProductHistory.PharmacyOrderId);
                Assert.Equal(dbProductHistory.Product.Id, dtoProductHistory.Product.Id);
                Assert.Equal(dbProductHistory.Product.Name, dtoProductHistory.Product.Name);
                Assert.Equal(dbProductHistory.Product.ProductProvider.Id, dtoProductHistory.Product.ProductProvider.Id);
                Assert.Equal(dbProductHistory.Product.ProductProvider.ProductId, dtoProductHistory.Product.ProductProvider.ProductId);
                Assert.Equal(dbProductHistory.Product.ProductProvider.ProviderId, dtoProductHistory.Product.ProductProvider.ProviderId);
                Assert.Equal(
                    dbProductHistory.ArrivalDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    dtoProductHistory.ArrivalDate);
            }
        }
    }

    [Fact]
    public void Should_MapAllFields_When_ConvertingOrderDtoToDbOrder()
    {
        OrderResponse orderDto = TestDataFactory.CreateComplexOrderDto(OrderState.Placement) with
        {
            Id = Guid.NewGuid(),
            ClientId = "client-dto-1",
            OrderNumber = "ORD-DTO-001",
            Comment = "dto-order-comment",
            CountryToDelivery = "Tajikistan",
            Courier = "Courier DTO",
            CommentForCourier = "dto-courier-comment",
            Operator = "Operator DTO",
            TotalCost = 700m,
            Prepayment = 100m,
            RestPayment = 600m,
            TotalOrderAmountExcludingDelivery = 660m,
            CityOrDistrict = "Khujand",
            PriceForDeliveryOutsideTheCity = 30m,
            RemainingPayment = 560m,
            AmountWithDiscount = 640m,
            AmountWithMarkup = 660m,
            AmountWithoutMarkup = 600m,
            AmountWithDelivery = 690m,
            AmountWithoutDelivery = 660m,
            Type = OrderType.Prescription,
            ComesFrom = OrderComesFrom.WhatsApp,
            DeliveryType = DeliveryType.Business,
            DeliveredAt = new DateTime(2026, 1, 25, 18, 0, 0),
            OrderHistory = TestDataFactory.CreateOrderHistoryDto(OrderState.Placed) with
            {
                Id = Guid.NewGuid(),
                OrderId = "order-map-dto-1",
                State = OrderState.Placed,
                PastState = OrderState.Placement,
                PaymentMethod = "Cash",
                PaymentStatus = PaymentStatus.Paid,
                ReturnedProductsCount = 2,
            },
        };

        DbOrder dbOrder = orderDto.DtoToOrder();

        Assert.Equal(orderDto.Id, dbOrder.Id);
        Assert.Equal(orderDto.ClientId, dbOrder.ClientId);
        Assert.Equal(orderDto.OrderNumber, dbOrder.OrderNumber);
        Assert.Equal(orderDto.Comment, dbOrder.Comment);
        Assert.Equal(orderDto.CountryToDelivery, dbOrder.CountryToDelivery);
        Assert.Equal(orderDto.Courier, dbOrder.Courier);
        Assert.Equal(orderDto.CommentForCourier, dbOrder.CommentForCourier);
        Assert.Equal(orderDto.Operator, dbOrder.Operator);
        Assert.Equal(orderDto.TotalCost, dbOrder.TotalCost);
        Assert.Equal(orderDto.Prepayment, dbOrder.Prepayment);
        Assert.Equal(orderDto.RestPayment, dbOrder.RestPayment);
        Assert.Equal(orderDto.TotalOrderAmountExcludingDelivery, dbOrder.TotalOrderAmountExcludingDelivery);
        Assert.Equal(orderDto.CityOrDistrict, dbOrder.CityOrDistrict);
        Assert.Equal(orderDto.PriceForDeliveryOutsideTheCity, dbOrder.PriceForDeliveryOutsideTheCity);
        Assert.Equal(orderDto.RemainingPayment, dbOrder.RemainingPayment);
        Assert.Equal(orderDto.AmountWithDiscount, dbOrder.AmountWithDiscount);
        Assert.Equal(orderDto.AmountWithMarkup, dbOrder.AmountWithMarkup);
        Assert.Equal(orderDto.AmountWithoutMarkup, dbOrder.AmountWithoutMarkup);
        Assert.Equal(orderDto.AmountWithDelivery, dbOrder.AmountWithDelivery);
        Assert.Equal(orderDto.AmountWithoutDelivery, dbOrder.AmountWithoutDelivery);
        Assert.Equal(orderDto.Type, dbOrder.Type);
        Assert.Equal(orderDto.ComesFrom, dbOrder.ComesFrom);
        Assert.Equal(orderDto.DeliveryType, dbOrder.DeliveryType);
        Assert.Equal(orderDto.DeliveredAt, dbOrder.DeliveredAt);

        Assert.Equal(orderDto.OrderHistory.Id, dbOrder.OrderHistory.Id);
        Assert.Equal(orderDto.OrderHistory.OrderId, dbOrder.OrderHistory.OrderId);
        Assert.Equal(orderDto.OrderHistory.PastState, dbOrder.OrderHistory.PastState);
        Assert.Equal(orderDto.OrderHistory.PaymentMethod, dbOrder.OrderHistory.PaymentMethod);
        Assert.Equal(orderDto.OrderHistory.PaymentStatus, dbOrder.OrderHistory.PaymentStatus);
        Assert.Equal(orderDto.OrderHistory.ReturnedProductsCount, dbOrder.OrderHistory.ReturnedProductsCount);

        Assert.Equal(orderDto.Client.Id, dbOrder.Client.Id);
        Assert.Equal(orderDto.Client.FullName, dbOrder.Client.FullName);
        Assert.Equal(orderDto.Client.PhoneNumber, dbOrder.Client.PhoneNumber);
        Assert.Equal(orderDto.Client.SocialUsername, dbOrder.Client.SocialUsername);
        Assert.Equal(orderDto.Client.Addresses?.Count, dbOrder.Client.Addresses?.Count);

        Assert.Equal(orderDto.PharmacyOrders.Count, dbOrder.PharmacyOrders.Count);
        foreach ((PharmacyOrderResponse dtoPharmacyOrder, DbPharmacyOrder dbPharmacyOrder) in orderDto.PharmacyOrders.Zip(dbOrder.PharmacyOrders))
        {
            Assert.Equal(dtoPharmacyOrder.Id, dbPharmacyOrder.Id);
            Assert.Equal(dtoPharmacyOrder.OrderId, dbPharmacyOrder.OrderId);
            Assert.Equal(dtoPharmacyOrder.PharmacyId, dbPharmacyOrder.PharmacyId);
            Assert.Equal(dtoPharmacyOrder.Pharmacy.Name, dbPharmacyOrder.Pharmacy.Name);
            Assert.Equal(dtoPharmacyOrder.ProductsHistories.Count, dbPharmacyOrder.ProductsHistories.Count);

            foreach ((ProductHistoryResponse dtoProductHistory, DbProductHistory dbProductHistory) in dtoPharmacyOrder.ProductsHistories.Zip(dbPharmacyOrder.ProductsHistories))
            {
                Assert.Equal(dtoProductHistory.Id, dbProductHistory.Id);
                Assert.Equal(dtoProductHistory.Count, dbProductHistory.Count);
                Assert.Equal(dtoProductHistory.ReturnedCount, dbProductHistory.ReturnedCount);
                Assert.Equal(dtoProductHistory.AmountWithMarkup, dbProductHistory.AmountWithMarkup);
                Assert.Equal(dtoProductHistory.AmountWithoutMarkup, dbProductHistory.AmountWithoutMarkup);
                Assert.Equal(dtoProductHistory.ProductId, dbProductHistory.ProductId);
                Assert.Equal(dtoProductHistory.PharmacyOrderId, dbProductHistory.PharmacyOrderId);
                Assert.Equal(dtoProductHistory.Product.Id, dbProductHistory.Product.Id);
                Assert.Equal(dtoProductHistory.Product.Name, dbProductHistory.Product.Name);
                Assert.Equal(dtoProductHistory.Product.ProductProvider.Id, dbProductHistory.Product.ProductProvider.Id);
                Assert.Equal(dtoProductHistory.Product.ProductProvider.ProductId, dbProductHistory.Product.ProductProvider.ProductId);
                Assert.Equal(dtoProductHistory.Product.ProductProvider.ProviderId, dbProductHistory.Product.ProductProvider.ProviderId);
                Assert.Equal(
                    DateTime.ParseExact(dtoProductHistory.ArrivalDate, "yyyy-MM-dd", CultureInfo.InvariantCulture),
                    dbProductHistory.ArrivalDate);
            }
        }
    }
}
