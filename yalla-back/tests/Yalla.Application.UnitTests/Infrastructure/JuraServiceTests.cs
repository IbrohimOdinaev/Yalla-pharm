using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Infrastructure.Jura;

namespace Yalla.Application.UnitTests.Infrastructure;

public sealed class JuraServiceTests
{
  [Fact]
  public async Task CalculateDeliveryAsync_UsesExternalApiCalculateEndpoint()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"amount":17,"distance":2.31}"""));
    var service = CreateService(handler);

    var result = await service.CalculateDeliveryAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.5598, 68.7870),
      tariffId: null,
      clientPhone: "000000000",
      CancellationToken.None);

    Assert.Equal(17m, result.Amount);
    Assert.Equal(2.31, result.Distance);
    Assert.Equal("/api/v2/login", handler.Requests[0].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/calculate?tariff_id=37&phone=992000000000", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task CalculateDeliveryAsync_WithDoorToDoor_SendsAllowanceInQuery()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"amount":22,"distance":2.31}"""));
    var service = CreateService(handler);

    await service.CalculateDeliveryAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.5598, 68.7870),
      tariffId: null,
      clientPhone: "000000000",
      CancellationToken.None,
      deliverToDoor: true);

    var decodedQuery = Uri.UnescapeDataString(handler.Requests[1].Query);
    Assert.Contains("""allowances=[{"allowance_id":17,"value":1}]""", decodedQuery);
  }

  [Fact]
  public async Task SearchAddressAsync_UsesExternalOrdersAddressSearchEndpoint()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      {
        "success": true,
        "message": "Success",
        "data": [
          {
            "id": 63413,
            "title": "Алиф",
            "body": "Платёжный терминал",
            "address": "Алиф, Платёжный терминал",
            "city": "шаҳр Душанбе",
            "type": "poi",
            "lng": 68.786342,
            "lat": 38.580832
          }
        ]
      }
      """));
    var service = CreateService(handler);

    var result = await service.SearchAddressAsync("Alif", CancellationToken.None);

    var suggestion = Assert.Single(result);
    Assert.Equal(63413, suggestion.Id);
    Assert.Equal("Алиф", suggestion.Title);
    Assert.Equal("Алиф, Платёжный терминал", suggestion.Address);
    Assert.Equal("poi", suggestion.Type);
    Assert.Equal(38.580832, suggestion.Lat);
    Assert.Equal(68.786342, suggestion.Lng);
    Assert.Equal("/api/v2/external-api/orders/address/search?text=Alif", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_SendsExternalApiBodyAndParsesResultWrapper()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"success":true,"data":[{"id":243138,"name":"Корпоративный баланс"}]}"""),
      Json(HttpStatusCode.OK, """
      {
        "message": "Заказ успешно создан",
        "result": {
          "id": 42106901,
          "status": "Поступило",
          "status_id": 1,
          "recipient_code": "1074",
          "performer": null
        }
      }
      """));
    var service = CreateService(handler);

    var result = await service.CreateDeliveryOrderAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.580832, 68.786342),
      tariffId: null,
      clientPhone: "000000003",
      CancellationToken.None);

    Assert.Equal(42106901, result.OrderId);
    Assert.Equal(1, result.StatusId);
    Assert.Equal("Поступило", result.Status);
    Assert.Equal("1074", result.RecipientCode);
    Assert.Equal("/api/v2/external-api/orders/pay-types", handler.Requests[1].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[2].PathAndQuery);

    using var body = JsonDocument.Parse(handler.Bodies[2] ?? "{}");
    Assert.Equal(6, body.RootElement.GetProperty("division_id").GetInt32());
    Assert.Equal(37, body.RootElement.GetProperty("tariff_id").GetInt32());
    Assert.Equal("992000000003", body.RootElement.GetProperty("phone").GetString());
    Assert.Equal(243138, body.RootElement.GetProperty("pay_type_id").GetInt64());
    Assert.True(body.RootElement.TryGetProperty("to_address", out _));
    Assert.False(body.RootElement.TryGetProperty("to_addresses", out _));
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WhenClientPhoneIsMissing_SendsFallbackPhone()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"success":true,"data":[{"id":243138,"name":"Корпоративный баланс"}]}"""),
      Json(HttpStatusCode.OK, """
      {
        "message": "Заказ успешно создан",
        "result": {
          "id": 42106901,
          "status": "Поступило",
          "status_id": 1
        }
      }
      """));
    var service = CreateService(handler);

    await service.CreateDeliveryOrderAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.580832, 68.786342),
      tariffId: null,
      clientPhone: null,
      CancellationToken.None);

    using var body = JsonDocument.Parse(handler.Bodies[2] ?? "{}");
    Assert.Equal("992000000000", body.RootElement.GetProperty("phone").GetString());
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WithDoorToDoor_SendsAllowanceInBody()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"success":true,"data":[{"id":243138,"name":"Корпоративный баланс"}]}"""),
      Json(HttpStatusCode.OK, """
      {
        "message": "Заказ успешно создан",
        "result": {
          "id": 42106901,
          "status": "Поступило",
          "status_id": 1
        }
      }
      """));
    var service = CreateService(handler);

    await service.CreateDeliveryOrderAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.580832, 68.786342),
      tariffId: null,
      clientPhone: "000000003",
      CancellationToken.None,
      deliverToDoor: true);

    using var body = JsonDocument.Parse(handler.Bodies[2] ?? "{}");
    var allowance = body.RootElement.GetProperty("allowances")[0];
    Assert.Equal(17, allowance.GetProperty("id").GetInt32());
    Assert.Equal(1m, allowance.GetProperty("price").GetDecimal());
    Assert.Equal("custom_type", allowance.GetProperty("type").GetString());
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WhenPayTypeIsInvalid_RetriesWithRefreshedCorporatePayType()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"success":true,"data":[{"id":243115,"name":"Корпоративный баланс"}]}"""),
      Json(HttpStatusCode.UnprocessableEntity, """
      {"status":422,"message":"Validation error","errors":{"pay_type_id":["Указанный тип оплаты не найден или не является корпоративным балансом."]}}
      """),
      Json(HttpStatusCode.OK, """{"success":true,"data":[{"id":243138,"name":"Корпоративный баланс"}]}"""),
      Json(HttpStatusCode.OK, """
      {
        "message": "Заказ успешно создан",
        "result": {
          "id": 42106902,
          "status": "Поступило",
          "status_id": 1
        }
      }
      """));
    var service = CreateService(handler);

    var result = await service.CreateDeliveryOrderAsync(
      Address("A", 38.573255, 68.786378),
      Address("B", 38.580832, 68.786342),
      tariffId: null,
      clientPhone: "000000003",
      CancellationToken.None);

    Assert.Equal(42106902, result.OrderId);
    Assert.Equal(5, handler.Requests.Count);
    Assert.Equal("/api/v2/external-api/orders/pay-types", handler.Requests[1].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[2].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/pay-types", handler.Requests[3].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[4].PathAndQuery);
    using var firstBody = JsonDocument.Parse(handler.Bodies[2] ?? "{}");
    using var secondBody = JsonDocument.Parse(handler.Bodies[4] ?? "{}");
    Assert.Equal(243115, firstBody.RootElement.GetProperty("pay_type_id").GetInt64());
    Assert.Equal(243138, secondBody.RootElement.GetProperty("pay_type_id").GetInt64());
    Assert.Equal("992000000003", secondBody.RootElement.GetProperty("phone").GetString());
  }

  [Fact]
  public async Task GetDriverPositionAsync_ReadsLatitudeLongitude_FromExternalApiResponse()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"success":true,"data":{"device_id":12345,"latitude":38.573255,"longitude":68.786378}}"""));
    var service = CreateService(handler);

    var result = await service.GetDriverPositionAsync(12345, CancellationToken.None);

    Assert.Equal(12345, result.DeviceId);
    Assert.Equal(38.573255, result.Lat);
    Assert.Equal(68.786378, result.Lng);
    Assert.Equal("/api/v2/external-api/traccar/position?device_id=12345", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task GetReceiptCodeAsync_ParsesUnwrappedExternalApiResponse()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """{"order_id":20619905,"receipt_code":"9300"}"""));
    var service = CreateService(handler);

    var result = await service.GetReceiptCodeAsync(20619905, CancellationToken.None);

    Assert.Equal("9300", result);
    Assert.Equal("/api/v2/external-api/orders/receipt-code?order_id=20619905", handler.Requests[1].PathAndQuery);
  }

  private static JuraService CreateService(HttpMessageHandler handler, IJuraHealthState? health = null)
  {
    var http = new HttpClient(handler)
    {
      BaseAddress = new Uri("https://test-admin.gram.tj")
    };

    return new JuraService(
      http,
      Options.Create(new JuraOptions
      {
        BaseUrl = "https://test-admin.gram.tj",
        Login = "120674",
        Password = "secret",
        DivisionId = 6,
        DefaultTariffId = 37
      }),
      NullLogger<JuraService>.Instance,
      health ?? new JuraHealthState());
  }

  private static JuraAddress Address(string title, double lat, double lng) => new()
  {
    Title = title,
    Address = title,
    Lat = lat,
    Lng = lng
  };

  private static HttpResponseMessage Json(HttpStatusCode statusCode, string content) => new(statusCode)
  {
    Content = new StringContent(content, Encoding.UTF8, "application/json")
  };

  private static HttpResponseMessage Text(HttpStatusCode statusCode, string content) => new(statusCode)
  {
    Content = new StringContent(content, Encoding.UTF8, "text/plain")
  };

  private sealed class SequenceMessageHandler : HttpMessageHandler
  {
    private readonly Queue<HttpResponseMessage> _responses;
    public List<Uri> Requests { get; } = [];
    public List<string?> Bodies { get; } = [];

    public SequenceMessageHandler(params HttpResponseMessage[] responses)
    {
      _responses = new Queue<HttpResponseMessage>(responses);
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
      Requests.Add(request.RequestUri ?? throw new InvalidOperationException("Request URI is missing."));
      Bodies.Add(request.Content is null
        ? null
        : await request.Content.ReadAsStringAsync(cancellationToken));

      if (_responses.Count == 0)
        throw new InvalidOperationException($"Unexpected request: {request.Method} {request.RequestUri}");

      return _responses.Dequeue();
    }
  }
}
