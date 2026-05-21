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
  private const string IntegrationOrdersBasePath = "/api/v2/integration/orders";
  private const string IntegrationTraccarBasePath = "/api/v2/integration/traccar";
  private const string LegacyOrdersBasePath = "/api/v2/external-api/orders";
  private const string LegacyTraccarBasePath = "/api/v2/external-api/traccar";

  private readonly HttpClient _http;
  private readonly JuraOptions _options;
  private readonly ILogger<JuraService> _logger;
  private readonly IJuraHealthState _health;
  private readonly SemaphoreSlim _authLock = new(1, 1);

  private string? _token;

  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
  };

  public JuraService(HttpClient http, IOptions<JuraOptions> options, ILogger<JuraService> logger, IJuraHealthState health)
  {
    _http = http;
    _options = options.Value;
    _logger = logger;
    _health = health;
  }

  // ─── Address Search ───

  public async Task<List<JuraAddressSuggestion>> SearchAddressAsync(string text, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"/api/v2/external-api/orders/address/search?text={Uri.EscapeDataString(text)}&division_id={_options.DivisionId}",
      null,
      ct,
      ensureSuccess: false,
      ignoreNotFoundFailure: true);

    if (response.StatusCode == HttpStatusCode.NotFound)
    {
      _logger.LogInformation("JURA address search endpoint is unavailable; returning no suggestions");
      return [];
    }

    response.EnsureSuccessStatusCode();

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
    var normalizedPhone = NormalizeJuraPhone(clientPhone);
    var query = $"tariff_id={effectiveTariffId}";
    if (!string.IsNullOrEmpty(normalizedPhone))
      query += $"&phone={Uri.EscapeDataString(normalizedPhone)}";

    var integrationBody = new
    {
      tariff_id = effectiveTariffId,
      phone = normalizedPhone,
      from_address = ToJuraAddressPayload(from),
      to_addresses = new[] { ToJuraAddressPayload(to) }
    };

    var legacyBody = new
    {
      from_address = ToJuraAddressPayload(from),
      to_addresses = new[] { ToJuraAddressPayload(to) }
    };

    var response = await SendWithIntegrationFallbackAsync(
      HttpMethod.Post,
      $"{IntegrationOrdersBasePath}/calculate",
      $"{LegacyOrdersBasePath}/calculate?{query}",
      integrationBody,
      legacyBody,
      ct);

    var result = await response.Content.ReadFromJsonAsync<JuraCalculateResponse>(JsonOptions, ct);
    var data = result?.Data ?? result;
    return new JuraCalculateResult
    {
      Amount = data?.Amount ?? data?.Cost ?? data?.Price ?? 0,
      Distance = data?.Distance ?? 0
    };
  }

  // ─── Create Delivery Order ───

  public async Task<JuraCreateOrderResult> CreateDeliveryOrderAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var normalizedPhone = NormalizeJuraPhone(clientPhone);
    var query = $"tariff_id={effectiveTariffId}";
    if (!string.IsNullOrEmpty(normalizedPhone))
      query += $"&phone={Uri.EscapeDataString(normalizedPhone)}";

    var integrationBody = new
    {
      tariff_id = effectiveTariffId,
      pay_type_id = _options.DefaultPayTypeId,
      phone = normalizedPhone,
      from_address = ToJuraAddressPayload(from),
      to_address = new[] { ToJuraAddressPayload(to) }
    };

    var legacyBody = new
    {
      pay_type_id = _options.DefaultPayTypeId,
      from_address = ToJuraAddressPayload(from),
      to_address = new[] { ToJuraAddressPayload(to) }
    };

    _logger.LogInformation("Creating JURA delivery order from {From} to {To}", from.Title, to.Title);

    var response = await SendWithIntegrationFallbackAsync(
      HttpMethod.Post,
      $"{IntegrationOrdersBasePath}/create",
      $"{LegacyOrdersBasePath}/create?{query}&pay_type_id={_options.DefaultPayTypeId}",
      integrationBody,
      legacyBody,
      ct);

    var result = await response.Content.ReadFromJsonAsync<JuraCreateOrderResponse>(JsonOptions, ct);
    var data = result?.Data ?? result;
    if (data == null)
      throw new InvalidOperationException("JURA create order returned null response");

    var orderId = data.Id != 0 ? data.Id : data.OrderId;
    _logger.LogInformation("JURA delivery order created: {OrderId}, status: {Status}",
      orderId, data.Status);

    return new JuraCreateOrderResult
    {
      OrderId = orderId,
      StatusId = data.StatusId,
      Status = data.Status ?? string.Empty,
      RecipientCode = data.RecipientCode,
      PerformerDeviceId = data.Performer?.TraccarDeviceId,
      PerformerFirstName = data.Performer?.FirstName,
      PerformerLastName = data.Performer?.LastName,
      PerformerPhone = data.Performer?.Phone
    };
  }

  // ─── Order Status ───

  public async Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct)
  {
    var response = await SendWithIntegrationFallbackAsync(
      HttpMethod.Get,
      $"{IntegrationOrdersBasePath}/status?order_id={juraOrderId}",
      $"{LegacyOrdersBasePath}/status?order_id={juraOrderId}",
      null,
      null,
      ct);

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
    var response = await SendWithIntegrationFallbackAsync(
      HttpMethod.Get,
      $"{IntegrationTraccarBasePath}/position?device_id={deviceId}",
      $"{LegacyTraccarBasePath}/position?device_id={deviceId}",
      null,
      null,
      ct);

    var result = await response.Content.ReadFromJsonAsync<JuraDataResponse<JuraPositionData>>(JsonOptions, ct);
    var data = result?.Data ?? throw new InvalidOperationException($"JURA traccar position returned null for device {deviceId}");

    return new JuraDriverPositionResult
    {
      DeviceId = data.DeviceId,
      Lat = data.Lat ?? data.Latitude ?? 0,
      Lng = data.Lng ?? data.Longitude ?? 0
    };
  }

  // ─── Cancel Order ───

  public async Task CancelOrderAsync(long juraOrderId, string reason, CancellationToken ct)
  {
    _logger.LogInformation("Cancelling JURA order {OrderId}, reason: {Reason}", juraOrderId, reason);

    await SendWithAuthAsync(HttpMethod.Post,
      $"/api/v2/external-api/orders/cancel?order_id={juraOrderId}&reason_cancel_order={Uri.EscapeDataString(reason)}",
      null, ct);
  }

  // ─── Receipt Code ───

  public async Task<string?> GetReceiptCodeAsync(long juraOrderId, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"/api/v2/external-api/orders/receipt-code?order_id={juraOrderId}", null, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraDataResponse<JuraReceiptCodeData>>(JsonOptions, ct);
    return result?.Data?.ReceiptCode;
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
    HttpMethod method,
    string url,
    object? body,
    CancellationToken ct,
    bool ensureSuccess = true,
    bool ignoreNotFoundFailure = false)
  {
    var token = await GetTokenAsync(ct);
    var response = await SendRequestAsync(method, url, body, token, ct, ignoreNotFoundFailure);

    if (response.StatusCode == HttpStatusCode.Unauthorized)
    {
      _logger.LogInformation("JURA token expired, re-authenticating");
      token = await AuthenticateAsync(ct);
      response = await SendRequestAsync(method, url, body, token, ct, ignoreNotFoundFailure);
    }

    if (ensureSuccess)
      response.EnsureSuccessStatusCode();

    return response;
  }

  private async Task<HttpResponseMessage> SendRequestAsync(
    HttpMethod method,
    string url,
    object? body,
    string token,
    CancellationToken ct,
    bool ignoreNotFoundFailure)
  {
    var request = new HttpRequestMessage(method, url);
    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

    if (body != null)
      request.Content = JsonContent.Create(body, options: JsonOptions);

    HttpResponseMessage response;
    try
    {
      response = await _http.SendAsync(request, ct);
    }
    catch (Exception ex)
    {
      _health.RecordHttpFailure(method.Method, url, null, ex.GetType().Name + ": " + ex.Message, DateTime.UtcNow);
      throw;
    }

    if (!response.IsSuccessStatusCode)
    {
      var responseText = await response.Content.ReadAsStringAsync(ct);
      _logger.LogWarning("JURA {Method} {Url} → {Status}: {Response}",
        method.Method, url, (int)response.StatusCode,
        responseText.Length > 500 ? responseText.Substring(0, 500) + "..." : responseText);

      response.Content = new StringContent(responseText, System.Text.Encoding.UTF8,
        response.Content.Headers.ContentType?.MediaType ?? "application/json");

      // 401 triggers re-auth at the caller; treat it as a neutral event, not failure.
      var isIgnoredNotFound = ignoreNotFoundFailure && response.StatusCode == HttpStatusCode.NotFound;
      if ((int)response.StatusCode != 401 && !isIgnoredNotFound)
        _health.RecordHttpFailure(method.Method, url, (int)response.StatusCode, responseText, DateTime.UtcNow);
    }
    else
    {
      _health.RecordHttpSuccess(method.Method, url, DateTime.UtcNow);
    }

    return response;
  }

  private async Task<HttpResponseMessage> SendWithIntegrationFallbackAsync(
    HttpMethod method,
    string integrationUrl,
    string legacyUrl,
    object? integrationBody,
    object? legacyBody,
    CancellationToken ct)
  {
    var response = await SendWithAuthAsync(
      method,
      integrationUrl,
      integrationBody,
      ct,
      ensureSuccess: false,
      ignoreNotFoundFailure: true);

    if (response.StatusCode != HttpStatusCode.NotFound)
    {
      response.EnsureSuccessStatusCode();
      return response;
    }

    var responseText = await response.Content.ReadAsStringAsync(ct);
    if (!IsRouteMissingResponse(responseText))
    {
      response.Content = new StringContent(responseText, System.Text.Encoding.UTF8, "application/json");
      response.EnsureSuccessStatusCode();
      return response;
    }

    response.Dispose();
    _logger.LogInformation(
      "JURA integration endpoint {Method} {IntegrationUrl} is unavailable; falling back to {LegacyUrl}",
      method.Method,
      integrationUrl,
      legacyUrl);

    return await SendWithAuthAsync(method, legacyUrl, legacyBody, ct);
  }

  private static bool IsRouteMissingResponse(string responseText) =>
    responseText.Contains("Requested URL not found", StringComparison.OrdinalIgnoreCase);

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

      _health.RecordAuthSuccess(DateTime.UtcNow);
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

  private static string? NormalizeJuraPhone(string? phone)
  {
    if (string.IsNullOrWhiteSpace(phone))
      return null;

    var digits = new string(phone.Where(char.IsDigit).ToArray());
    if (digits.Length == 9)
      return "992" + digits;

    return digits.Length == 0 ? null : digits;
  }

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
    public bool Success { get; set; }
    public JuraCalculateResponse? Data { get; set; }
    public decimal? Amount { get; set; }
    public decimal? Cost { get; set; }
    public decimal? Price { get; set; }
    public double? Distance { get; set; }
  }

  private sealed class JuraCreateOrderResponse
  {
    public bool Success { get; set; }
    public JuraCreateOrderResponse? Data { get; set; }
    public long Id { get; set; }
    public long OrderId { get; set; }
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
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
  }

  private sealed class JuraTariffData
  {
    public int Id { get; set; }
    public string? Name { get; set; }
    public int DivisionId { get; set; }
  }

  private sealed class JuraReceiptCodeData
  {
    public long OrderId { get; set; }
    public string? ReceiptCode { get; set; }
  }
}
