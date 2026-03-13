using System.Globalization;

namespace Yalla.BusinessLogic.Tests.TestInfrastructure;

internal static class TestDataFactory
{
    private static Guid G(string raw) => TestIds.Id(raw);

    public static ClientResponse CreateClientDto() => new()
    {
        Id = Guid.NewGuid(),
        FullName = "Test Client",
        Street = "Main street",
        PhoneNumber = "+992000000001",
        SocialUsername = "@client",
        Language = Language.Ru,
        Gender = Gender.Male,
        Type = TypeOfClient.Undefined,
        ContactType = ContactType.Telegram,
    };

    public static DbClient CreateDbClient() => TestEntityFactory.Create<DbClient>(
        ("Id", Guid.NewGuid()),
        ("FullName", "Test Client"),
        ("Street", "Main street"),
        ("PhoneNumber", "+992000000001"),
        ("SocialUsername", "@client"),
        ("Language", Language.Ru),
        ("Gender", Gender.Male),
        ("Type", TypeOfClient.Undefined),
        ("ContactType", ContactType.Telegram));

    public static CountryResponse CreateCountryDto() => new()
    {
        Id = Guid.NewGuid(),
        Country = "Tajikistan",
        City = "Dushanbe",
    };

    public static DbCountry CreateDbCountry() => TestEntityFactory.Create<DbCountry>(
        ("Id", Guid.NewGuid()),
        ("Country", "Tajikistan"),
        ("City", "Dushanbe"));

    public static PackagingTypeResponse CreatePackagingTypeDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Box",
    };

    public static DbPackagingType CreateDbPackagingType() => TestEntityFactory.Create<DbPackagingType>(
        ("Id", Guid.NewGuid()),
        ("Name", "Box"));

    public static PackagingUnitResponse CreatePackagingUnitDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "mg",
    };

    public static DbPackagingUnit CreateDbPackagingUnit() => TestEntityFactory.Create<DbPackagingUnit>(
        ("Id", Guid.NewGuid()),
        ("Name", "mg"));

    public static PaymentMethodResponse CreatePaymentMethodDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Cash",
    };

    public static DbPaymentMethod CreateDbPaymentMethod() => TestEntityFactory.Create<DbPaymentMethod>(
        ("Id", Guid.NewGuid()),
        ("Name", "Cash"));

    public static PharmacyResponse CreatePharmacyDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Pharmacy",
        Address = "Address",
        Landmark = "Near main street",
        Contact = "+992900000000",
        Country = "Tajikistan",
        GeolocationLink = "https://map.test/pharmacy",
        PayoutMethod = PharmacyPayoutMethod.Cash,
    };

    public static DbPharmacy CreateDbPharmacy(bool isAbroad = false) => TestEntityFactory.Create<DbPharmacy>(
        ("Id", Guid.NewGuid()),
        ("Name", "Pharmacy"),
        ("Address", "Address"),
        ("Country", "Tajikistan"),
        ("GeolocationLink", ""),
        ("IsAbroad", isAbroad));

    public static ProviderResponse CreateProviderDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Provider",
        Contact = "@provider",
        ContactType = ContactType.Telegram,
        Country = "Tajikistan",
        City = "Dushanbe",
        LinkFromWhereFoundAbroad = "https://example.test/provider",
    };

    public static DbProvider CreateDbProvider() => TestEntityFactory.Create<DbProvider>(
        ("Id", Guid.NewGuid()),
        ("Name", "Provider"),
        ("Contact", "@provider"),
        ("ContactType", ContactType.Telegram),
        ("Country", "Tajikistan"),
        ("City", "Dushanbe"));

    public static ProductResponse CreateProductDto(decimal priceWithMarkup = 100, decimal priceWithoutMarkup = 90) => new()
    {
        Id = G("product-1"),
        Name = "Paracetamol",
        Type = "Medicine",
        PriceWithMarkup = priceWithMarkup,
        PriceWithoutMarkup = priceWithoutMarkup,
        State = ProductState.Buys,
        PackagingUnit = "mg",
        TypeOfPackaging = "box",
        ReleaseForm = "tablet",
        Country = "Tajikistan",
        Manufacturer = "Factory",
        Dosage = "500",
        PathImage = "/images/product.png",
        LinkProduct = "https://example.test/product",
        CountOnPackage = 1,
        ProductProvider = new ProductProviderResponse
        {
            Id = G("product-provider-1"),
            ProductId = G("product-1"),
            ProviderId = G("provider-1"),
            Provider = CreateProviderDto() with { Id = G("provider-1") },
        },
    };

    public static DbProduct CreateDbProduct(decimal priceWithMarkup = 100, decimal priceWithoutMarkup = 90)
    {
        DbProvider provider = TestEntityFactory.Mutate(CreateDbProvider(), ("Id", G("provider-1")));

        DbProductProvider productProvider = TestEntityFactory.Create<DbProductProvider>(
            ("Id", G("product-provider-1")),
            ("ProductId", G("product-1")),
            ("ProviderId", G("provider-1")),
            ("Provider", provider));

        return TestEntityFactory.Create<DbProduct>(
            ("Id", G("product-1")),
            ("Name", "Paracetamol"),
            ("Type", "Medicine"),
            ("Dosage", "500"),
            ("CountOnPackage", 1),
            ("AgeFrom", 0),
            ("AgeTo", 100),
            ("PriceWithMarkup", priceWithMarkup),
            ("PriceWithoutMarkup", priceWithoutMarkup),
            ("State", ProductState.Buys),
            ("PackagingUnit", "mg"),
            ("TypeOfPackaging", "box"),
            ("ReleaseForm", "tablet"),
            ("Country", "Tajikistan"),
            ("Manufacturer", "Factory"),
            ("PathImage", "/images/product.png"),
            ("LinkProduct", "https://example.test/product"),
            ("ProductProvider", productProvider));
    }

    public static ProductHistoryResponse CreateProductHistoryDto(int count = 1) => new()
    {
        Id = G("history-1"),
        Count = count,
        Product = CreateProductDto(),
        AmountWithMarkup = 100,
        AmountWithoutMarkup = 90,
        PharmacyOrderId = G("pharmacy-order-1"),
        ProductId = G("product-1"),
        ArrivalDate = "2026-01-10",
    };

    public static DbProductHistory CreateDbProductHistory(int count = 1)
    {
        DbProduct product = CreateDbProduct();

        return TestEntityFactory.Create<DbProductHistory>(
            ("Id", G("history-1")),
            ("Count", count),
            ("Product", product),
            ("AmountWithMarkup", 100m),
            ("AmountWithoutMarkup", 90m),
            ("PharmacyOrderId", G("pharmacy-order-1")),
            ("ProductId", G("product-1")),
            ("ArrivalDate", new DateTime(2026, 1, 10)));
    }

    public static ProductHistoryResponse CreateProductHistoryDtoDetailed(
        string id,
        int count,
        decimal priceWithMarkup,
        decimal priceWithoutMarkup,
        ProductState state = ProductState.Buys,
        bool isReturned = false,
        int returnedCount = 0,
        string arrivalDate = "2026-01-10")
    {
        Guid productId = G($"product-{id}");

        ProductResponse product = CreateProductDto(priceWithMarkup, priceWithoutMarkup) with
        {
            Id = productId,
            State = state,
        };

        return new ProductHistoryResponse
        {
            Id = G(id),
            Count = count,
            ReturnedCount = returnedCount,
            IsReturned = isReturned,
            ProductId = productId,
            PharmacyOrderId = G($"pharmacy-order-{id}"),
            Product = product,
            ArrivalDate = arrivalDate,
        };
    }

    public static DbProductHistory CreateDbProductHistoryDetailed(
        string id,
        int count,
        decimal priceWithMarkup,
        decimal priceWithoutMarkup,
        ProductState state = ProductState.Buys,
        bool isReturned = false,
        int returnedCount = 0,
        DateTime? arrivalDate = null)
    {
        Guid productId = G($"product-{id}");

        DbProduct product = TestEntityFactory.Mutate(CreateDbProduct(priceWithMarkup, priceWithoutMarkup),
            ("Id", productId),
            ("State", state));

        return TestEntityFactory.Create<DbProductHistory>(
            ("Id", G(id)),
            ("Count", count),
            ("ReturnedCount", returnedCount),
            ("IsReturned", isReturned),
            ("ProductId", productId),
            ("PharmacyOrderId", G($"pharmacy-order-{id}")),
            ("Product", product),
            ("ArrivalDate", arrivalDate ?? new DateTime(2026, 1, 10)));
    }

    public static PharmacyOrderResponse CreatePharmacyOrderDto() => new()
    {
        Id = G("pharmacy-order-1"),
        PharmacyId = G("pharmacy-1"),
        Pharmacy = CreatePharmacyDto() with { Id = G("pharmacy-1") },
        ProductsHistories = new List<ProductHistoryResponse>
        {
            CreateProductHistoryDto(),
        },
    };

    public static DbPharmacyOrder CreateDbPharmacyOrder()
    {
        DbPharmacy pharmacy = TestEntityFactory.Mutate(CreateDbPharmacy(), ("Id", G("pharmacy-1")));

        return TestEntityFactory.Create<DbPharmacyOrder>(
            ("Id", G("pharmacy-order-1")),
            ("PharmacyId", G("pharmacy-1")),
            ("Pharmacy", pharmacy),
            ("ProductsHistories", new List<DbProductHistory> { CreateDbProductHistory() }));
    }

    public static PharmacyOrderResponse CreatePharmacyOrderDtoDetailed(
        string id,
        string pharmacyId,
        params ProductHistoryResponse[] productHistories)
    {
        Guid pharmacyGuid = G(pharmacyId);

        return new PharmacyOrderResponse
        {
            Id = G(id),
            PharmacyId = pharmacyGuid,
            Pharmacy = CreatePharmacyDto() with { Id = pharmacyGuid },
            ProductsHistories = productHistories.ToList(),
        };
    }

    public static DbPharmacyOrder CreateDbPharmacyOrderDetailed(
        string id,
        Guid pharmacyId,
        DbPharmacy pharmacy,
        params DbProductHistory[] productHistories)
    {
        return TestEntityFactory.Create<DbPharmacyOrder>(
            ("Id", G(id)),
            ("PharmacyId", pharmacyId),
            ("Pharmacy", pharmacy),
            ("ProductsHistories", productHistories.ToList()));
    }

    public static ProductProviderResponse CreateProductProviderDto() => new()
    {
        Id = G("product-provider-1"),
        ProductId = G("product-1"),
        ProviderId = G("provider-1"),
        Product = CreateProductDto() with { Id = G("product-1") },
        Provider = CreateProviderDto() with { Id = G("provider-1") },
    };

    public static DbProductProvider CreateDbProductProvider() => TestEntityFactory.Create<DbProductProvider>(
        ("Id", G("product-provider-1")),
        ("ProductId", G("product-1")),
        ("ProviderId", G("provider-1")),
        ("Product", CreateDbProduct()),
        ("Provider", CreateDbProvider()));

    public static ProductTemplateResponse CreateProductTemplateDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Template",
        Nickname = "Template Nick",
        ActiveIngredient = "Ingredient",
        PackQuantityOrDrugVolume = "10",
        Dosage = "500mg",
        PreparationTaste = "None",
        Instructions = "Use by instruction",
        IndicationForUse = "Use",
        ContraindicationForUse = "Contra",
        Symptom = "Pain",
        DriedFruit = "None",
        Comment = "No comment",
        WithCaution = "None",
    };

    public static DbProductTemplate CreateDbProductTemplate() => TestEntityFactory.Create<DbProductTemplate>(
        ("Id", Guid.NewGuid()),
        ("Name", "Template"),
        ("PackQuantityOrDrugVolume", "10"),
        ("IndicationForUse", "Use"),
        ("ContraindicationForUse", "Contra"),
        ("Dosage", "500"),
        ("ActiveIngredient", "Active"),
        ("PreparationTaste", "None"),
        ("Symptom", "Pain"),
        ("DriedFruit", "No"),
        ("WithCaution", "None"));

    public static ReleaseFormResponse CreateReleaseFormDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Tablet",
    };

    public static DbReleaseForm CreateDbReleaseForm() => TestEntityFactory.Create<DbReleaseForm>(
