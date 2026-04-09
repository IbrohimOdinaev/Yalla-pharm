using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Response;

namespace Yalla.Infrastructure.Jura;

public sealed class JuraService : IJuraService
{
  private readonly HttpClient _http;
  private readonly JuraOptions _options;
  private readonly ILogger<JuraService> _logger;
  private readonly SemaphoreSlim _authLock = new(1, 1);

  private string? _token;

  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
  };

  public JuraService(HttpClient http, IOptions<JuraOptions> options, ILogger<JuraService> logger)
  {
    _http = http;
    _options = options.Value;
    _logger = logger;
  }

  // ─── Address Search ───

  public async Task<List<JuraAddressSuggestion>> SearchAddressAsync(string text, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"/api/address/search?text={Uri.EscapeDataString(text)}&division_id={_options.DivisionId}", null, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraDataResponse<List<JuraSearchItem>>>(JsonOptions, ct);
    if (result?.Success != true || result.Data == null)
      return [];

    return result.Data.Select(d => new JuraAddressSuggestion
    {
      Id = d.Id,
      Title = d.Title ?? string.Empty,
      Address = d.Address ?? string.Empty,
      Type = d.Type ?? string.Empty,
      Lat = d.Lat,
      Lng = d.Lng
    }).ToList();
  }

  // ─── Calculate Delivery ───

  public async Task<JuraCalculateResult> CalculateDeliveryAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var query = $"tariff_id={effectiveTariffId}";
    if (!string.IsNullOrEmpty(clientPhone))
      query += $"&phone={Uri.EscapeDataString(clientPhone)}";

    var body = new
    {
      from_address = ToJuraAddressPayload(from),
      to_addresses = new[] { ToJuraAddressPayload(to) }
    };

    var response = await SendWithAuthAsync(HttpMethod.Post,
      $"/api/v2/integration/orders/calculate?{query}", body, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraCalculateResponse>(JsonOptions, ct);
    return new JuraCalculateResult
    {
      Amount = result?.Amount ?? 0,
      Distance = result?.Distance ?? 0
    };
  }

  // ─── Create Delivery Order ───

  public async Task<JuraCreateOrderResult> CreateDeliveryOrderAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var query = $"tariff_id={effectiveTariffId}";
    if (!string.IsNullOrEmpty(clientPhone))
      query += $"&phone={Uri.EscapeDataString(clientPhone)}";

    var body = new
    {
      from_address = ToJuraAddressPayload(from),
      to_address = new[] { ToJuraAddressPayload(to) }
    };

    _logger.LogInformation("Creating JURA delivery order from {From} to {To}", from.Title, to.Title);

    var response = await SendWithAuthAsync(HttpMethod.Post,
      $"/api/v2/integration/orders/create?{query}", body, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraCreateOrderResponse>(JsonOptions, ct);
    if (result == null)
      throw new InvalidOperationException("JURA create order returned null response");

    _logger.LogInformation("JURA delivery order created: {OrderId}, status: {Status}",
      result.Id, result.Status);

    return new JuraCreateOrderResult
    {
      OrderId = result.Id,
      StatusId = result.StatusId,
      Status = result.Status ?? string.Empty,
      RecipientCode = result.RecipientCode,
      PerformerDeviceId = result.Performer?.TraccarDeviceId,
      PerformerFirstName = result.Performer?.FirstName,
      PerformerLastName = result.Performer?.LastName,
      PerformerPhone = result.Performer?.Phone
    };
  }

  // ─── Order Status ───

  public async Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"/api/v2/integration/orders/status?order_id={juraOrderId}", null, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraDataResponse<JuraOrderStatusData>>(JsonOptions, ct);
    var data = result?.Data ?? throw new InvalidOperationException($"JURA order status returned null for {juraOrderId}");

    return new JuraOrderStatusResult
    {
      OrderId = data.OrderId,
      StatusId = data.StatusId,
      Status = data.Status ?? string.Empty,
      PerformerId = data.PerformerId,
      TraccarDeviceId = data.TraccarDeviceId,
      FirstName = data.FirstName,
      LastName = data.LastName,
      Phone = data.Phone
    };
  }

  // ─── Driver Position ───

  public async Task<JuraDriverPositionResult> GetDriverPositionAsync(long deviceId, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"/api/v2/integration/traccar/position?device_id={deviceId}", null, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraDataResponse<JuraPositionData>>(JsonOptions, ct);
    var data = result?.Data ?? throw new InvalidOperationException($"JURA traccar position returned null for device {deviceId}");

    return new JuraDriverPositionResult
    {
      DeviceId = data.DeviceId,
      Lat = data.Lat,
      Lng = data.Lng
    };
  }

  // ─── Cancel Order ───

  public async Task CancelOrderAsync(long juraOrderId, string reason, CancellationToken ct)
  {
    _logger.LogInformation("Cancelling JURA order {OrderId}, reason: {Reason}", juraOrderId, reason);

    await SendWithAuthAsync(HttpMethod.Post,
      $"/api/v2/integration/orders/cancel?order_id={juraOrderId}&reason_cancel_order={Uri.EscapeDataString(reason)}",
      null, ct);
  }

  // ─── Tariffs ───

  public async Task<List<JuraTariff>> GetTariffsAsync(CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      "/api/v2/users/tariffs", null, ct);

    var result = await response.Content.ReadFromJsonAsync<List<JuraTariffData>>(JsonOptions, ct);
    return result?.Select(t => new JuraTariff
    {
      Id = t.Id,
      Name = t.Name ?? string.Empty,
      DivisionId = t.DivisionId
    }).ToList() ?? [];
  }

  // ─── Auth & HTTP helpers ───

  private async Task<HttpResponseMessage> SendWithAuthAsync(
    HttpMethod method, string url, object? body, CancellationToken ct)
  {
    var token = await GetTokenAsync(ct);
    var response = await SendRequestAsync(method, url, body, token, ct);

    if (response.StatusCode == HttpStatusCode.Unauthorized)
    {
      _logger.LogInformation("JURA token expired, re-authenticating");
      token = await AuthenticateAsync(ct);
      response = await SendRequestAsync(method, url, body, token, ct);
    }

    response.EnsureSuccessStatusCode();
    return response;
  }

  private async Task<HttpResponseMessage> SendRequestAsync(
    HttpMethod method, string url, object? body, string token, CancellationToken ct)
  {
    var request = new HttpRequestMessage(method, url);
    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

    if (body != null)
      request.Content = JsonContent.Create(body, options: JsonOptions);

    return await _http.SendAsync(request, ct);
  }

  private async Task<string> GetTokenAsync(CancellationToken ct)
  {
    if (_token != null)
      return _token;

    return await AuthenticateAsync(ct);
  }

  private async Task<string> AuthenticateAsync(CancellationToken ct)
  {
    await _authLock.WaitAsync(ct);
    try
    {
      _logger.LogInformation("Authenticating with JURA API");

      var response = await _http.PostAsJsonAsync("/api/v2/login",
        new { login = _options.Login, password = _options.Password }, JsonOptions, ct);

      response.EnsureSuccessStatusCode();

      var result = await response.Content.ReadFromJsonAsync<JuraLoginResponse>(JsonOptions, ct);
      _token = result?.Token ?? throw new InvalidOperationException("JURA login returned no token");

      _logger.LogInformation("JURA authentication successful");
      return _token;
    }
    finally
    {
      _authLock.Release();
    }
  }

  private static object ToJuraAddressPayload(JuraAddress addr) => new
  {
    id = addr.Id,
    address = addr.Address,
    title = addr.Title,
    lng = addr.Lng,
    lat = addr.Lat
  };

  // ─── Internal response models ───

  private sealed class JuraLoginResponse
  {
    public bool Success { get; set; }
    public string? Token { get; set; }
  }

  private sealed class JuraDataResponse<T>
  {
    public bool Success { get; set; }
    public T? Data { get; set; }
  }

  private sealed class JuraSearchItem
  {
    public long Id { get; set; }
    public string? Title { get; set; }
    public string? Address { get; set; }
    public string? Type { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
  }

  private sealed class JuraCalculateResponse
  {
    public decimal Amount { get; set; }
    public double Distance { get; set; }
  }

  private sealed class JuraCreateOrderResponse
  {
    public long Id { get; set; }
    public int StatusId { get; set; }
    public string? Status { get; set; }
    public string? RecipientCode { get; set; }
    public JuraPerformerData? Performer { get; set; }
  }

  private sealed class JuraPerformerData
  {
    public long? TraccarDeviceId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
  }

  private sealed class JuraOrderStatusData
  {
    public long OrderId { get; set; }
    public int StatusId { get; set; }
    public string? Status { get; set; }
    public long? PerformerId { get; set; }
    public long? TraccarDeviceId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
  }

  private sealed class JuraPositionData
  {
    public long DeviceId { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
  }

  private sealed class JuraTariffData
  {
    public int Id { get; set; }
    public string? Name { get; set; }
    public int DivisionId { get; set; }
  }
}
