using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Yalla.Presentation.Tests.Helpers;

namespace Yalla.Presentation.Tests.Controllers;

public sealed class NegativeScenariosIntegrationTests
{
    [Fact]
    public async Task Should_ReturnBadRequest_When_ModelIsInvalid_ForUserCreate()
    {
        Mock<IUserService> userServiceMock = new();
        userServiceMock
            .Setup(x => x.CreateAsync(It.IsAny<UserResponse>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await using ApiWebApplicationFactory factory = new(
            ApiWebApplicationFactory.CreatePrincipal("Administrator"),
            services =>
            {
                services.RemoveAll<IUserService>();
                services.AddSingleton(userServiceMock.Object);
            });

        HttpClient client = factory.CreateClient();
        const string requestJson = """
            {
              "id": "user-invalid-1",
              "firstName": "Test",
              "lastName": "User",
              "phoneNumber": "",
              "email": "invalid.user@yalla.test",
              "password": "password-123",
              "role": 4
            }
            """;

        HttpResponseMessage response = await client.PostAsync(
            "/user",
            new StringContent(requestJson, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        userServiceMock.Verify(x => x.CreateAsync(It.IsAny<UserResponse>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Should_ReturnBadRequest_When_ModelIsInvalid_ForProductCreate()
    {
        Mock<IProductService> productServiceMock = new();
        productServiceMock
            .Setup(x => x.CreateAsync(It.IsAny<ProductResponse>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await using ApiWebApplicationFactory factory = new(
            ApiWebApplicationFactory.CreatePrincipal("Administrator"),
            services =>
            {
                services.RemoveAll<IProductService>();
                services.AddSingleton(productServiceMock.Object);
            });

        HttpClient client = factory.CreateClient();
        ProductResponse invalidProduct = CreateValidProductDto() with
        {
            PriceWithMarkup = -1,
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/product", invalidProduct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        productServiceMock.Verify(x => x.CreateAsync(It.IsAny<ProductResponse>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Should_ReturnBadRequest_When_ModelIsInvalid_ForProductTemplateCreate()
    {
        Mock<IProductTemplateService> templateServiceMock = new();
        templateServiceMock
            .Setup(x => x.CreateAsync(It.IsAny<ProductTemplateResponse>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await using ApiWebApplicationFactory factory = new(
            ApiWebApplicationFactory.CreatePrincipal("Administrator"),
            services =>
            {
                services.RemoveAll<IProductTemplateService>();
                services.AddSingleton(templateServiceMock.Object);
            });

        HttpClient client = factory.CreateClient();
        ProductTemplateResponse invalidTemplate = CreateValidProductTemplateDto() with
        {
            Comment = new string('x', 5001),
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/productTemplate", invalidTemplate);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        templateServiceMock.Verify(
            x => x.CreateAsync(It.IsAny<ProductTemplateResponse>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Should_ReturnNotFound_When_ServiceThrowsKeyNotFoundException()
    {
        Mock<IUserService> userServiceMock = new();
        userServiceMock
            .Setup(x => x.GetAsync(TestIds.Id("missing-user"), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("User missing-user was not found."));

        await using ApiWebApplicationFactory factory = new(
            ApiWebApplicationFactory.CreatePrincipal("Administrator"),
            services =>
            {
                services.RemoveAll<IUserService>();
                services.AddSingleton(userServiceMock.Object);
            });

        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync($"/user/{TestIds.Id("missing-user")}");
        string content = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("User missing-user was not found.", content);
    }

    [Fact]
    public async Task Should_ReturnBadRequest_When_ServiceThrowsArgumentException()
    {
        Mock<IUserService> userServiceMock = new();
        userServiceMock
            .Setup(x => x.CreateAsync(It.IsAny<UserResponse>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ArgumentException("Phone format is invalid."));

        await using ApiWebApplicationFactory factory = new(
            ApiWebApplicationFactory.CreatePrincipal("Administrator"),
            services =>
            {
                services.RemoveAll<IUserService>();
                services.AddSingleton(userServiceMock.Object);
            });

        HttpClient client = factory.CreateClient();
        UserResponse userDto = new()
        {
            Id = Guid.NewGuid(),
            FirstName = "Valid",
            LastName = "User",
            PhoneNumber = "+992900001111",
            Email = "valid.user@yalla.test",
            Password = "password-123",
            Role = UserRole.Administrator,
        };

        HttpResponseMessage response = await client.PostAsJsonAsync("/user", userDto);
        string content = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Phone format is invalid.", content);
    }

    [Fact]
    public async Task Should_ReturnForbidden_When_OperatorDeletesUser()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Operator"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.DeleteAsync("/user/user-1");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Should_ReturnForbidden_When_OperatorDeletesPaymentMethod()
    {
        await using ApiWebApplicationFactory factory = new(ApiWebApplicationFactory.CreatePrincipal("Operator"));
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.DeleteAsync("/api/paymentMethod/payment-1");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static ProductResponse CreateValidProductDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Paracetamol",
        Type = "Medicine",
        Dosage = "500mg",
        CountOnPackage = 10,
        AgeFrom = 0,
        AgeTo = 99,
        PriceWithMarkup = 100,
        PriceWithoutMarkup = 80,
        Manufacturer = "Yalla Pharma",
        PathImage = "image.png",
        Dificit = false,
        ReleaseForm = "Tablet",
        PackagingUnit = "mg",
        TypeOfPackaging = "Box",
        LinkProduct = "https://example.test/product",
        Country = "Tajikistan",
        AgeType = AgeType.Adult,
        IsRequired = false,
        State = ProductState.Buys,
        ProductProvider = new ProductProviderResponse
        {
            Id = Guid.NewGuid(),
        }
    };

    private static ProductTemplateResponse CreateValidProductTemplateDto() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Template Name",
        Nickname = "Template Nick",
        ActiveIngredient = "Ingredient",
        Dosage = "500mg",
        MinimumQuantityPerPiece = 1,
        PackQuantityOrDrugVolume = "10",
        IndicationForUse = "Take after meal",
        ContraindicationForUse = "No contraindication",
        Symptom = "Pain",
        Comment = "Valid comment",
    };
}
