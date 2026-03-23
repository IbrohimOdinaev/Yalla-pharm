namespace Yalla.DataAccess.Tests.TestInfrastructure;

internal static class DataAccessTestDataFactory
{
    public static DbOrder CreateOrderAggregate(
        string orderId,
        string orderNumber,
        OrderState state,
        DateTime createdAt,
        string clientPhone,
        string clientName)
    {
        string clientId = $"client-{orderId}";
        string pharmacyId = $"pharmacy-{orderId}";
        string providerId = $"provider-{orderId}";
        string productId = $"product-{orderId}";
        string productProviderId = $"product-provider-{orderId}";
        string pharmacyOrderId = $"pharmacy-order-{orderId}";
        string productHistoryId = $"history-{orderId}";

        DbProvider provider = new()
        {
            Id = providerId,
            Name = $"Provider {orderId}",
            ContactType = ContactType.Telegram,
            Contact = "@provider",
            Country = "Tajikistan",
            City = "Dushanbe",
            LinkFromWhereFoundAbroad = "https://example.test/provider",
        };

        DbProduct product = new()
        {
            Id = productId,
            Name = $"Product {orderId}",
            Type = "Medicine",
            Dosage = "500mg",
            CountOnPackage = 10,
            AgeFrom = 0,
            AgeTo = 99,
            PriceWithMarkup = 120m,
            PriceWithoutMarkup = 100m,
            Manufacturer = "Factory",
            PathImage = "product.png",
            Dificit = false,
            ReleaseForm = "Tablet",
            PackagingUnit = "mg",
            TypeOfPackaging = "Box",
            LinkProduct = "https://example.test/product",
            Country = "Tajikistan",
            AgeType = AgeType.Adult,
            IsRequired = false,
            State = ProductState.Buys,
            ProductProvider = new DbProductProvider
            {
                Id = productProviderId,
                ProductId = productId,
                ProviderId = providerId,
                Provider = provider,
            },
        };

        DbPharmacy pharmacy = new()
        {
            Id = pharmacyId,
            Name = $"Pharmacy {orderId}",
            Address = "Main street 1",
            Landmark = "Near park",
            Contact = "+992900000000",
            GeolocationLink = "https://map.test/pharmacy",
            Country = "Tajikistan",
            Markup = 10m,
            MarkupType = MarkupType.Markup,
            IsAbroad = false,
            IsRequired = false,
            PayoutMethod = PharmacyPayoutMethod.Cash,
        };

        DbProductHistory productHistory = new()
        {
            Id = productHistoryId,
            PharmacyOrderId = pharmacyOrderId,
            ProductId = productId,
            Product = product,
            Message = "Available",
            Count = 2,
            ReturnedCount = 0,
            IsReturned = false,
            AmountWithMarkup = 240m,
            AmountWithoutMarkup = 200m,
            CreatedAt = createdAt,
            ArrivalDate = createdAt.Date,
            ReturnTo = ReturnedType.Pharmacy,
            Comment = "history comment",
        };

        DbPharmacyOrder pharmacyOrder = new()
        {
            Id = pharmacyOrderId,
            OrderId = orderId,
            PharmacyId = pharmacyId,
            Pharmacy = pharmacy,
            ProductsHistories = new List<DbProductHistory> { productHistory },
        };

        DbClient client = new()
        {
            Id = clientId,
            FullName = clientName,
            Street = "Client street 10",
            Landmark = "Landmark",
            GeolocationOfClientAddress = "geo-client",
            PhoneNumber = clientPhone,
            SocialUsername = "@client",
            Language = Language.Ru,
            HavingChildren = false,
            HavingElderly = false,
            Gender = Gender.Female,
            FamilyStatus = FamilyStatus.Single,
            EconomicStanding = EconomicStanding.Fine,
            ChildrensAge = ChildrensAge.Undefined,
            Type = TypeOfClient.People,
            ContactType = ContactType.Telegram,
            TakeIntoAccount = "none",
            DiscountForClient = 0,
            Addresses = new List<DbAddress>
            {
                new()
                {
                    Id = $"address-{orderId}",
                    ClientId = clientId,
                    Street = "Client street 10",
                    Landmark = "Near school",
                    City = "Dushanbe",
                    GeolocationOfClientAddress = "geo-client-10",
                },
            },
            Childrens = new List<DbClientChildrens>(),
            Adults = new List<DbClientAdults>(),
        };

        DbOrderHistory orderHistory = new()
        {
            Id = $"order-history-{orderId}",
            OrderId = orderId,
            Message = "Order history message",
            CreatedAt = createdAt,
            State = state,
            PastState = OrderState.Application,
            PaymentStatus = PaymentStatus.PartiallyPaid,
            PaymentMethod = "Cash",
            IsReturned = false,
            RequestDate = createdAt.AddMinutes(-15),
            OrderDate = createdAt,
            TimeForAcceptingRequest = createdAt.AddMinutes(5),
            TimeInformCustomerAboutProduct = createdAt.AddMinutes(10),
            AmountOfTimeRespondClient = 20,
            TimeToObtainClientApproval = createdAt.AddMinutes(15),
            TimeToSendCheckToClient = createdAt.AddMinutes(20),
            RequestProcessingTime = createdAt.AddMinutes(25),
            CommentForCourier = "Call before arrival",
            ReasonForOrderDelay = string.Empty,
            ReasonForOrderCancellation = string.Empty,
            ReasonForOrderRejection = string.Empty,
            CallingAt = "18:00",
            IndividualDeliveryTime = createdAt.AddHours(2),
            LongSearchReason = string.Empty,
            OrderProcessingTime = createdAt.AddMinutes(30),
            AmountOfProcessingTime = 30,
            AmountOfDeliveryTime = 40,
            DeliveredTime = createdAt.AddHours(3),
            TimeOfCompletionOfInquiry = createdAt.AddHours(4),
            ReasonForReturningTheOrder = string.Empty,
            ReturnedProductsCount = 0,
            WasRejection = false,
        };

        return new DbOrder
        {
            Id = orderId,
            ClientId = clientId,
            OrderNumber = orderNumber,
            Comment = "Order comment",
            CountryToDelivery = "Tajikistan",
            Courier = "Courier A",
            CommentForCourier = "Handle with care",
            Operator = "Operator A",
            TotalCost = 260m,
            Prepayment = 50m,
            RestPayment = 210m,
            Discount = 5m,
            TotalOrderAmountExcludingDelivery = 240m,
            CityOrDistrict = "Dushanbe",
            PriceForDeliveryOutsideTheCity = 20m,
            RemainingPayment = 190m,
            AmountWithDiscount = 247m,
            AmountWithMarkup = 240m,
            AmountWithoutMarkup = 200m,
            AmountWithDelivery = 260m,
            AmountWithoutDelivery = 240m,
            Type = OrderType.Prescription,
            ComesFrom = OrderComesFrom.Telegram,
            DeliveryType = DeliveryType.Comfort,
            DeliveredAt = createdAt.AddHours(5),
            Client = client,
            OrderHistory = orderHistory,
            PharmacyOrders = new List<DbPharmacyOrder> { pharmacyOrder },
        };
    }
}
