using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using Yalla.Api.IntegrationTests.TestInfrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class BasketAndMedicinesIntegrationTests : ApiTestBase
{
  public BasketAndMedicinesIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task Basket_Get_AsClient_ShouldReturnCurrentBasket()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync("/api/basket");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.True(payload.GetProperty("basketItemsCount").GetInt32() >= 1);
  }

  [Fact]
  public async Task Basket_Get_AsAdmin_ShouldReturnForbidden()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Admin1);

    var response = await client.GetAsync("/api/basket");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Basket_AddItem_WithInvalidDto_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.PostAsJsonAsync("/api/basket/items", new
    {
      MedicineId = Guid.Empty,
      Quantity = 0
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Basket_AddUpdateRemoveClear_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var addResponse = await client.PostAsJsonAsync("/api/basket/items", new
    {
      MedicineId = ApiTestData.Medicine1Id,
      Quantity = 1
    });
    Assert.Equal(HttpStatusCode.OK, addResponse.StatusCode);

    var basketResponse = await client.GetAsync("/api/basket");
    Assert.Equal(HttpStatusCode.OK, basketResponse.StatusCode);
    var basketPayload = await ReadJsonAsync(basketResponse);
    var positionId = basketPayload.GetProperty("basketPositions")[0].GetProperty("positionId").GetGuid();

    var updateResponse = await client.PatchAsJsonAsync("/api/basket/items/quantity", new
    {
      PositionId = positionId,
      Quantity = 3
    });
    Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

    var removeResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/basket/items")
    {
      Content = JsonContent.Create(new
      {
        PositionId = positionId
      })
    });
    Assert.Equal(HttpStatusCode.OK, removeResponse.StatusCode);

    var clearResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/basket")
    {
      Content = JsonContent.Create(new { })
    });
    Assert.Equal(HttpStatusCode.OK, clearResponse.StatusCode);
  }

  [Fact]
  public async Task Medicines_Catalog_AsClient_ShouldReturnItems()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync("/api/medicines?page=1&pageSize=20");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.True(payload.GetProperty("medicines").GetArrayLength() >= 1);
  }

  [Fact]
  public async Task Medicines_GetByUnknownId_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.GetAsync($"/api/medicines/{Guid.NewGuid()}");

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal("invalid_operation", payload.GetProperty("errorCode").GetString());
  }

  [Fact]
  public async Task Medicines_Create_AsClient_ShouldReturnForbidden()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.PostAsJsonAsync("/api/medicines", new
    {
      Title = "Client Medicine",
      Articul = "CLIENT-1",
      Atributes = new[] { new { Name = "dosage", Option = "100mg" } }
    });

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task Medicines_CreateUpdateDelete_AsSuperAdmin_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var uniqueArticul = $"ADM-{Guid.NewGuid():N}";

    var createResponse = await client.PostAsJsonAsync("/api/medicines", new
    {
      Title = "Ibuprofen",
      Articul = uniqueArticul,
      Atributes = new[] { new { Name = "dosage", Option = "200mg" } }
    });
    Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

    var createPayload = await ReadJsonAsync(createResponse);
    var medicineId = createPayload.GetProperty("medicine").GetProperty("id").GetGuid();

    var updateResponse = await client.PutAsJsonAsync("/api/medicines", new
    {
      MedicineId = medicineId,
      Title = "Ibuprofen Updated",
      Articul = uniqueArticul
    });
    Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

    var deleteResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/medicines")
    {
      Content = JsonContent.Create(new
      {
        MedicineId = medicineId
      })
    });
    Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
  }

  [Fact]
  public async Task Medicines_Search_WithInvalidLimit_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.Client1);

    var response = await client.PostAsJsonAsync("/api/medicines/search", new
    {
      Query = "par",
      Limit = 0
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
  }

  [Fact]
  public async Task Medicines_CreateAndDeleteImage_AsSuperAdmin_ShouldSucceed()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var uniqueArticul = $"IMG-{Guid.NewGuid():N}";

    var createMedicineResponse = await client.PostAsJsonAsync("/api/medicines", new
    {
      Title = "Medicine With Image",
      Articul = uniqueArticul,
      Atributes = new[] { new { Name = "dosage", Option = "100mg" } }
    });
    Assert.Equal(HttpStatusCode.OK, createMedicineResponse.StatusCode);

    var createMedicinePayload = await ReadJsonAsync(createMedicineResponse);
    var medicineId = createMedicinePayload.GetProperty("medicine").GetProperty("id").GetGuid();

    using var multipart = new MultipartFormDataContent();
    multipart.Add(new StringContent(medicineId.ToString()), "MedicineId");
    multipart.Add(new StringContent("true"), "IsMain");
    multipart.Add(new StringContent("true"), "IsMinimal");
    var imageContent = new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    imageContent.Headers.ContentType = MediaTypeHeaderValue.Parse("image/png");
    multipart.Add(imageContent, "image", "medicine.png");

    var createImageResponse = await client.PostAsync("/api/medicines/images", multipart);
    Assert.Equal(HttpStatusCode.OK, createImageResponse.StatusCode);

    var createImagePayload = await ReadJsonAsync(createImageResponse);
    var medicineImageId = createImagePayload.GetProperty("medicineImage").GetProperty("id").GetGuid();

    var deleteImageResponse = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/medicines/images")
    {
      Content = JsonContent.Create(new
      {
        MedicineId = medicineId,
        MedicineImageId = medicineImageId
      })
    });
    Assert.Equal(HttpStatusCode.OK, deleteImageResponse.StatusCode);
  }

  [Fact]
  public async Task Medicines_ImageContentEndpoint_ShouldReturnImageBytesWithoutRedirect()
  {
    using var superAdminClient = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var uniqueArticul = $"IMG-CONTENT-{Guid.NewGuid():N}";

    var createMedicineResponse = await superAdminClient.PostAsJsonAsync("/api/medicines", new
    {
      Title = "Medicine Image Content",
      Articul = uniqueArticul,
      Atributes = new[] { new { Name = "dosage", Option = "100mg" } }
    });
    Assert.Equal(HttpStatusCode.OK, createMedicineResponse.StatusCode);

    var createMedicinePayload = await ReadJsonAsync(createMedicineResponse);
    var medicineId = createMedicinePayload.GetProperty("medicine").GetProperty("id").GetGuid();

    using var multipart = new MultipartFormDataContent();
    multipart.Add(new StringContent(medicineId.ToString()), "MedicineId");
    multipart.Add(new StringContent("true"), "IsMain");
    multipart.Add(new StringContent("true"), "IsMinimal");
    var imageBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
    var imageContent = new ByteArrayContent(imageBytes);
    imageContent.Headers.ContentType = MediaTypeHeaderValue.Parse("image/png");
    multipart.Add(imageContent, "image", "medicine.png");

    var createImageResponse = await superAdminClient.PostAsync("/api/medicines/images", multipart);
    Assert.Equal(HttpStatusCode.OK, createImageResponse.StatusCode);

    var createImagePayload = await ReadJsonAsync(createImageResponse);
    var medicineImageId = createImagePayload.GetProperty("medicineImage").GetProperty("id").GetGuid();

    using var anonymousClient = CreateClient();
    var contentResponse = await anonymousClient.GetAsync($"/api/medicines/images/{medicineImageId}/content");

    Assert.Equal(HttpStatusCode.OK, contentResponse.StatusCode);
    Assert.Equal("image/png", contentResponse.Content.Headers.ContentType?.MediaType);
    var downloadedBytes = await contentResponse.Content.ReadAsByteArrayAsync();
    Assert.True(downloadedBytes.Length >= imageBytes.Length);
    Assert.Equal(imageBytes[0], downloadedBytes[0]);
    Assert.Equal(imageBytes[1], downloadedBytes[1]);
  }

  [Fact]
  public async Task Medicines_CreateImage_WithInvalidContent_AsSuperAdmin_ShouldReturnBadRequest()
  {
    using var client = await CreateAuthorizedClientAsync(TestActor.SuperAdmin);
    var uniqueArticul = $"IMG-BAD-{Guid.NewGuid():N}";

    var createMedicineResponse = await client.PostAsJsonAsync("/api/medicines", new
    {
      Title = "Medicine Invalid Image",
      Articul = uniqueArticul,
      Atributes = new[] { new { Name = "dosage", Option = "50mg" } }
    });
    Assert.Equal(HttpStatusCode.OK, createMedicineResponse.StatusCode);

    var createMedicinePayload = await ReadJsonAsync(createMedicineResponse);
    var medicineId = createMedicinePayload.GetProperty("medicine").GetProperty("id").GetGuid();

    using var multipart = new MultipartFormDataContent();
    multipart.Add(new StringContent(medicineId.ToString()), "MedicineId");
    multipart.Add(new StringContent("true"), "IsMain");
    multipart.Add(new StringContent("false"), "IsMinimal");
    var invalidImage = new ByteArrayContent([1, 2, 3, 4, 5]);
    invalidImage.Headers.ContentType = MediaTypeHeaderValue.Parse("image/png");
    multipart.Add(invalidImage, "image", "broken.png");

    var response = await client.PostAsync("/api/medicines/images", multipart);
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

    var payload = await ReadJsonAsync(response);
    Assert.Equal("invalid_operation", payload.GetProperty("errorCode").GetString());
  }
}
