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
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[1].PathAndQuery);

    using var body = JsonDocument.Parse(handler.Bodies[1] ?? "{}");
    Assert.Equal(6, body.RootElement.GetProperty("division_id").GetInt32());
    Assert.Equal(37, body.RootElement.GetProperty("tariff_id").GetInt32());
    Assert.Equal("992000000003", body.RootElement.GetProperty("phone").GetString());
    Assert.Equal(29185, body.RootElement.GetProperty("pay_type_id").GetInt64());
    Assert.True(body.RootElement.TryGetProperty("to_address", out _));
    Assert.False(body.RootElement.TryGetProperty("to_addresses", out _));
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WhenClientPhoneIsMissing_SendsFallbackPhone()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
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

    using var body = JsonDocument.Parse(handler.Bodies[1] ?? "{}");
    Assert.Equal("992000000000", body.RootElement.GetProperty("phone").GetString());
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WithDoorToDoor_SendsAllowanceInBody()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
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

    using var body = JsonDocument.Parse(handler.Bodies[1] ?? "{}");
    var allowance = body.RootElement.GetProperty("allowances")[0];
    Assert.Equal(17, allowance.GetProperty("id").GetInt32());
    Assert.Equal(1m, allowance.GetProperty("price").GetDecimal());
    Assert.Equal("custom_type", allowance.GetProperty("type").GetString());
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_UsesConfiguredPayTypeBeforeFetchingPayTypes()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      {
        "success": true,
        "code": 200,
        "message": "ok",
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
      CancellationToken.None);

    Assert.Equal(2, handler.Requests.Count);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[1].PathAndQuery);
    using var body = JsonDocument.Parse(handler.Bodies[1] ?? "{}");
    Assert.Equal(29185, body.RootElement.GetProperty("pay_type_id").GetInt64());
  }

  [Fact]
  public async Task CreateDeliveryOrderAsync_WhenPayTypeIsInvalid_RetriesWithRefreshedCorporatePayType()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
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
    Assert.Equal(4, handler.Requests.Count);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[1].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/pay-types", handler.Requests[2].PathAndQuery);
    Assert.Equal("/api/v2/external-api/orders/create", handler.Requests[3].PathAndQuery);
    using var firstBody = JsonDocument.Parse(handler.Bodies[1] ?? "{}");
    using var secondBody = JsonDocument.Parse(handler.Bodies[3] ?? "{}");
    Assert.Equal(29185, firstBody.RootElement.GetProperty("pay_type_id").GetInt64());
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

  [Fact]
  public async Task GetPayTypesAsync_ParsesNewResultWrapper()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      {
        "success": true,
        "code": 200,
        "message": "ok",
        "result": [
          {
            "id": 212605,
            "type": "ClientBalance",
            "text": "Лицевой счет",
            "col_type": true
          },
          {
            "id": 243115,
            "type": "CompanyBalance",
            "text": "",
            "col_type": false
          }
        ]
      }
      """));
    var service = CreateService(handler);

    var result = await service.GetPayTypesAsync(CancellationToken.None);

    Assert.Equal(2, result.Count);
    Assert.Equal(212605, result[0].Id);
    Assert.Equal("ClientBalance", result[0].Type);
    Assert.Equal("Лицевой счет", result[0].Text);
    Assert.True(result[0].ColType);
    Assert.Equal(243115, result[1].Id);
    Assert.Equal("CompanyBalance", result[1].Type);
    Assert.False(result[1].ColType);
    Assert.Equal("/api/v2/external-api/orders/pay-types", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task GetAllowancesAsync_UsesExternalApiAllowancesEndpoint()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      [
        {
          "allowance_id": 10,
          "price": 0.8,
          "type": "minute",
          "is_fix_price": 0,
          "name": "Ожидание",
          "icon": "https://api-3taxi.gram.tj/storage/allowances/wait.png"
        },
        {
          "allowance_id": 20,
          "price": 5,
          "type": "fix",
          "is_fix_price": 1,
          "name": "Буксировочный ключ",
          "icon": "https://api-3taxi.gram.tj/storage/allowances/key.png"
        }
      ]
      """));
    var service = CreateService(handler);

    var result = await service.GetAllowancesAsync(49, CancellationToken.None);

    Assert.Equal(2, result.Count);
    Assert.Equal(10, result[0].AllowanceId);
    Assert.Equal(0.8m, result[0].Price);
    Assert.Equal("minute", result[0].Type);
    Assert.False(result[0].IsFixPrice);
    Assert.Equal(20, result[1].AllowanceId);
    Assert.Equal(5m, result[1].Price);
    Assert.True(result[1].IsFixPrice);
    Assert.Equal("/api/v2/external-api/orders/allowances?tariff_id=49", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task GetActiveOrdersAsync_ParsesNewResultWrapper()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      {
        "success": true,
        "code": 200,
        "message": "ok",
        "result": [
          {
            "id": 20620358,
            "division_id": 6,
            "status": "Поступило",
            "status_id": 1,
            "client_status": 0,
            "tariff": "Курьер на авто",
            "tariff_id": 37,
            "distance": 309.92,
            "prices": {
              "amount": 1222
            },
            "recipient_code": "7479",
            "performer": {
              "traccar_device_id": 5483
            }
          }
        ]
      }
      """));
    var service = CreateService(handler);

    var result = await service.GetActiveOrdersAsync("927782615", CancellationToken.None);

    var order = Assert.Single(result);
    Assert.Equal(20620358, order.OrderId);
    Assert.Equal(6, order.DivisionId);
    Assert.Equal(1, order.StatusId);
    Assert.Equal("Поступило", order.Status);
    Assert.Equal(0, order.ClientStatus);
    Assert.Equal(37, order.TariffId);
    Assert.Equal("Курьер на авто", order.Tariff);
    Assert.Equal(309.92, order.Distance);
    Assert.Equal(1222m, order.Amount);
    Assert.Equal("7479", order.RecipientCode);
    Assert.Equal(5483, order.PerformerDeviceId);
    Assert.Equal("/api/v2/external-api/orders/active-order?phone=992927782615", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task GetActiveOrdersAsync_ReturnsEmptyList_WhenJuraReturnsNotFound()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.NotFound, """{"success":false,"message":"Client not found","data":null}"""));
    var service = CreateService(handler);

    var result = await service.GetActiveOrdersAsync("992920000000", CancellationToken.None);

    Assert.Empty(result);
    Assert.Equal("/api/v2/external-api/orders/active-order?phone=992920000000", handler.Requests[1].PathAndQuery);
  }

  [Fact]
  public async Task GetCitiesAsync_ParsesExternalApiCities()
  {
    var handler = new SequenceMessageHandler(
      Json(HttpStatusCode.OK, """{"success":true,"token":"test-token"}"""),
      Json(HttpStatusCode.OK, """
      [
        {
          "id": 6,
          "baseId": "9D301000000000000",
          "name": "Душанбе",
          "region": "район республиканского подчинения",
          "lng": 68.762734,
          "lat": 38.557282
        }
      ]
      """));
    var service = CreateService(handler);

    var result = await service.GetCitiesAsync(CancellationToken.None);

    var city = Assert.Single(result);
    Assert.Equal(6, city.Id);
    Assert.Equal("9D301000000000000", city.BaseId);
    Assert.Equal("Душанбе", city.Name);
    Assert.Equal("район республиканского подчинения", city.Region);
    Assert.Equal(38.557282, city.Lat);
    Assert.Equal(68.762734, city.Lng);
    Assert.Equal("/api/v2/external-api/orders/get-cities", handler.Requests[1].PathAndQuery);
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
