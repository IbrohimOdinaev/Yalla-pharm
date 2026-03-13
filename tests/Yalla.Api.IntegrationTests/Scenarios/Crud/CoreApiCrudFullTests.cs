using Yalla.Api.IntegrationTests.Fixtures;
using Yalla.Api.IntegrationTests.TestData;

namespace Yalla.Api.IntegrationTests.Scenarios.Crud;

[Collection(IntegrationTestCollection.Name)]
[Trait("Category", "Full")]
public sealed class CoreApiCrudFullTests(IntegrationTestFixture fixture) : IAsyncLifetime
{
    [Fact]
    public async Task ClientCrud_ShouldCreateReadUpdateDelete()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string uniqueSuffix = Guid.NewGuid().ToString("N")[..8];
        string phoneNumber = $"+9929001{uniqueSuffix[..4]}";
        string updatedName = $"Client Updated {uniqueSuffix}";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/clients", new
        {
            fullName = $"Client {uniqueSuffix}",
            street = "Rudaki 1",
            landmark = "Center",
            geolocationOfClientAddress = "0,0",
            phoneNumber,
            age = 30,
            socialUsername = "",
            language = 1,
            havingChildren = false,
            havingElderly = false,
            gender = 1,
            familyStatus = 1,
            economicStanding = 3,
            childrensAge = 1,
            type = 1,
            contactType = 1,
            takeIntoAccount = "",
            discountForClient = 0
        });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.True(await createResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listResponse = await client.GetAsync("/api/clients");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Guid createdId = await ExtractIdByPropertyAsync(listResponse, "phoneNumber", phoneNumber);

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync("/api/clients/update", new
        {
            id = createdId,
            fullName = updatedName,
            street = "Rudaki 2",
            landmark = "Updated landmark",
            geolocationOfClientAddress = "1,1",
            phoneNumber,
            age = 31,
            socialUsername = "",
            language = 1,
            havingChildren = false,
            havingElderly = false,
            gender = 1,
            familyStatus = 1,
            economicStanding = 3,
            childrensAge = 1,
            type = 1,
            contactType = 1,
            takeIntoAccount = "",
            discountForClient = 0
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(await updateResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage getResponse = await client.GetAsync($"/api/clients/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        using JsonDocument clientDocument = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        Assert.Equal(updatedName, clientDocument.RootElement.GetProperty("fullName").GetString());

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"/api/clients/{createdId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.True(await deleteResponse.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task PharmacyCrud_ShouldCreateReadUpdateDelete()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string uniqueSuffix = Guid.NewGuid().ToString("N")[..8];
        string pharmacyName = $"Pharmacy-{uniqueSuffix}";
        string updatedLandmark = $"Landmark-{uniqueSuffix}";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/pharmacy", new
        {
            name = pharmacyName,
            address = "Main street 1",
            landmark = "Initial landmark",
            contact = "+992900000200",
            geolocationLink = "https://maps.local/1",
            country = "Tajikistan",
            markup = 10m,
            markupType = 1,
            isRequired = false,
            isAbroad = false,
            payoutMethod = 1
        });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.True(await createResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listResponse = await client.GetAsync("/api/pharmacy");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listResponse, pharmacyName);

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync("/api/pharmacy/update", new
        {
            id = createdId,
            name = pharmacyName,
            address = "Main street 2",
            landmark = updatedLandmark,
            contact = "+992900000201",
            geolocationLink = "https://maps.local/2",
            country = "Tajikistan",
            markup = 12m,
            markupType = 1,
            isRequired = true,
            isAbroad = false,
            payoutMethod = 2
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(await updateResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage getResponse = await client.GetAsync($"/api/pharmacy/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        using JsonDocument pharmacyDocument = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        Assert.Equal(updatedLandmark, pharmacyDocument.RootElement.GetProperty("landmark").GetString());

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"/api/pharmacy/{createdId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.True(await deleteResponse.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task ProductCrud_ShouldCreateReadUpdateDelete()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string uniqueSuffix = Guid.NewGuid().ToString("N")[..8];
        Guid productId = Guid.NewGuid();
        Guid providerId = Guid.NewGuid();
        string productName = $"Product-{uniqueSuffix}";
        string updatedName = $"Product-Updated-{uniqueSuffix}";

        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/product", new
        {
            id = productId,
            name = productName,
            type = "Medicine",
            dosage = "500mg",
            countOnPackage = 10,
            ageFrom = 0,
            ageTo = 99,
            priceWithMarkup = 100m,
            priceWithoutMarkup = 80m,
            manufacturer = "Yalla Pharma",
            pathImage = "image.png",
            dificit = false,
            releaseForm = "Tablet",
            packagingUnit = "mg",
            typeOfPackaging = "Box",
            linkProduct = "https://example.test/product",
            country = "Tajikistan",
            ageType = 1,
            isRequired = false,
            state = 1,
            productProvider = new
            {
                productId,
                providerId
            }
        });

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.True(await createResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage listResponse = await client.GetAsync("/api/product");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Guid createdId = await JsonTestHelpers.ExtractIdByNameAsync(listResponse, productName);

        HttpResponseMessage updateResponse = await client.PostAsJsonAsync("/api/product/update", new
        {
            id = createdId,
            name = updatedName,
            type = "Medicine",
            dosage = "500mg",
            countOnPackage = 20,
            ageFrom = 1,
            ageTo = 100,
            priceWithMarkup = 120m,
            priceWithoutMarkup = 90m,
            manufacturer = "Yalla Pharma Updated",
            pathImage = "image-updated.png",
            dificit = false,
            releaseForm = "Tablet",
            packagingUnit = "mg",
            typeOfPackaging = "Box",
            linkProduct = "https://example.test/product-updated",
            country = "Tajikistan",
            ageType = 1,
            isRequired = true,
            state = 1,
            productProvider = new
            {
                productId = createdId,
                providerId
            }
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(await updateResponse.Content.ReadFromJsonAsync<bool>());

        HttpResponseMessage getResponse = await client.GetAsync($"/api/product/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        using JsonDocument productDocument = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        Assert.Equal(updatedName, productDocument.RootElement.GetProperty("name").GetString());

        HttpResponseMessage deleteResponse = await client.DeleteAsync($"/api/product/{createdId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.True(await deleteResponse.Content.ReadFromJsonAsync<bool>());
    }

    [Fact]
    public async Task ProductTemplateEndpoints_ShouldReflectCurrentModelBinding_AndSaveImage()
    {
        using HttpClient client = fixture.CreateAuthenticatedClient("Administrator");

        string uniqueSuffix = Guid.NewGuid().ToString("N")[..8];
        string templateName = $"Template-{uniqueSuffix}";
        Guid templateId = Guid.NewGuid();

        object createRequest = BuildProductTemplateRequest(templateId, templateName, "Initial comment");
        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/productTemplate", createRequest);
        string createPayload = await createResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, createResponse.StatusCode);
        Assert.Contains("ForWhom.ForWhom", createPayload);
        Assert.Contains("PreparationColor.PreparationColor", createPayload);
        Assert.Contains("PackagingMaterial.PackagingMaterial", createPayload);
        Assert.Contains("TimeOfApplication.TimeOfApplication", createPayload);
        Assert.Contains("PreparationMaterial.PreparationMaterial", createPayload);

        HttpResponseMessage listResponse = await client.GetAsync("/api/productTemplate");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        HttpResponseMessage imageResponse = await client.PostAsJsonAsync("/api/productTemplate/image", "base64-image-content");
        Assert.Equal(HttpStatusCode.OK, imageResponse.StatusCode);
        string imagePayload = await imageResponse.Content.ReadAsStringAsync();
        Assert.Contains("https://integration-tests.local/fake-image.jpg", imagePayload);
    }

    public Task InitializeAsync() => fixture.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static object BuildProductTemplateRequest(Guid id, string name, string comment) => new
    {
        id,
        categoryId = Guid.NewGuid(),
        withCaution = "Use with caution",
        vacationCondition = 3,
        name,
        nickname = "Template Nickname",
        activeIngredient = "Ingredient",
        dosage = "500mg",
        dosageUnit = 2,
        minimumQuantityPerPiece = 1u,
        packQuantityOrDrugVolume = "10",
        packagingUnit = 1,
        preparationTaste = "Sweet",
        ageFrom = 0,
        ageTo = 99,
        instructions = "Take after meal",
        indicationForUse = "Pain relief",
        contraindicationForUse = "No severe contraindications",
        symptom = "Pain",
        forAllergySufferers = 1,
        forDiabetics = 1,
        forPregnantWomen = 1,
        forChildren = 1,
        forDriver = 1,
        seasonOfApplication = 2,
        driedFruit = "None",
        comment,
        forWhomId = Guid.NewGuid(),
        applicationMethodId = Guid.NewGuid(),
        organsAndSystemsId = Guid.NewGuid(),
        packagingMaterialId = Guid.NewGuid(),
        preparationColorId = Guid.NewGuid(),
        preparationMaterialId = Guid.NewGuid(),
        scopeOfApplicationId = Guid.NewGuid(),
        timeOfApplicationId = Guid.NewGuid(),
        forWhom = new
        {
            forWhom = "Adults"
        },
        packagingMaterial = new
        {
            packagingMaterial = "Blister"
        },
        preparationColor = new
        {
            preparationColor = "White"
        },
        preparationMaterial = new
        {
            preparationMaterial = "Powder"
        },
        timeOfApplication = new
        {
            timeOfApplication = "Morning"
        }
    };

    private static async Task<Guid> ExtractIdByPropertyAsync(HttpResponseMessage response, string propertyName, string expectedValue)
    {
        string payload = await response.Content.ReadAsStringAsync();
        using JsonDocument document = JsonDocument.Parse(payload);

        JsonElement item = document.RootElement
            .EnumerateArray()
            .Single(entry => string.Equals(
                entry.GetProperty(propertyName).GetString(),
                expectedValue,
                StringComparison.OrdinalIgnoreCase));

        return item.GetProperty("id").GetGuid();
    }
}
