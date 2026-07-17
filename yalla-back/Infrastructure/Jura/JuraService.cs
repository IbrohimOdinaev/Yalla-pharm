using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Response;

namespace Yalla.Infrastructure.Jura;

public sealed class JuraService : IJuraService
{
  private const string ExternalOrdersBasePath = "/api/v2/external-api/orders";
  private const string ExternalTraccarBasePath = "/api/v2/external-api/traccar";

  private readonly HttpClient _http;
  private readonly JuraOptions _options;
  private readonly ILogger<JuraService> _logger;
  private readonly IJuraHealthState _health;
  private readonly SemaphoreSlim _authLock = new(1, 1);
  private readonly SemaphoreSlim _payTypeLock = new(1, 1);

  private string? _token;
  private long? _corporatePayTypeId;

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
      $"{ExternalOrdersBasePath}/address/search?text={Uri.EscapeDataString(text)}",
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

  // ─── Cities ───

  public async Task<List<JuraCity>> GetCitiesAsync(CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"{ExternalOrdersBasePath}/get-cities",
      null,
      ct);

    var result = await ReadJuraListAsync<JuraCityData>(response, ct);
    return result.Select(c => new JuraCity
    {
      Id = c.Id,
      BaseId = c.BaseId ?? string.Empty,
      Name = c.Name ?? string.Empty,
      Region = c.Region ?? string.Empty,
      Lat = c.Lat,
      Lng = c.Lng
    }).ToList();
  }

  // ─── Calculate Delivery ───

  public async Task<JuraCalculateResult> CalculateDeliveryAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct, bool deliverToDoor = false)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var normalizedPhone = NormalizeJuraPhone(clientPhone);
    var query = $"tariff_id={effectiveTariffId}";
    if (!string.IsNullOrEmpty(normalizedPhone))
      query += $"&phone={Uri.EscapeDataString(normalizedPhone)}";
    query = AppendAllowancesQuery(query, deliverToDoor);

    var body = new
    {
      from_address = ToJuraAddressPayload(from),
      to_addresses = new[] { ToJuraAddressPayload(to) }
    };

    var response = await SendWithAuthAsync(
      HttpMethod.Post,
      $"{ExternalOrdersBasePath}/calculate?{query}",
      body,
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
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct, bool deliverToDoor = false)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var normalizedPhone = NormalizeJuraPhone(clientPhone) ?? NormalizeJuraPhone("000000000")!;
    var payTypeId = await ResolveCorporatePayTypeIdAsync(ct);

    _logger.LogInformation("Creating JURA delivery order from {From} to {To}", from.Title, to.Title);

    var body = BuildCreateOrderPayload(from, to, effectiveTariffId, normalizedPhone, deliverToDoor, payTypeId);
    var response = await SendWithAuthAsync(
      HttpMethod.Post,
      $"{ExternalOrdersBasePath}/create",
      body,
      ct,
      ensureSuccess: false);

    if (await HasValidationErrorAsync(response, "pay_type_id", ct))
    {
      var refreshedPayTypeId = await ResolveCorporatePayTypeIdAsync(ct, forceRefresh: true);
      if (refreshedPayTypeId.HasValue && refreshedPayTypeId != payTypeId)
      {
        _logger.LogWarning(
          "JURA rejected pay_type_id {PayTypeId}; retrying create order with refreshed corporate pay_type_id {RefreshedPayTypeId}.",
          payTypeId,
          refreshedPayTypeId);
        body = BuildCreateOrderPayload(from, to, effectiveTariffId, normalizedPhone, deliverToDoor, refreshedPayTypeId);
        response = await SendWithAuthAsync(
          HttpMethod.Post,
          $"{ExternalOrdersBasePath}/create",
          body,
          ct,
          ensureSuccess: false);
      }
      else
      {
        _logger.LogWarning(
          "JURA rejected pay_type_id {PayTypeId}; no alternate corporate pay_type_id was found.",
          payTypeId);
      }
    }

    response.EnsureSuccessStatusCode();

    var result = await response.Content.ReadFromJsonAsync<JuraCreateOrderResponse>(JsonOptions, ct);
    var data = result?.Data ?? result?.Result ?? result;
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

  private static JuraAllowancePayload[]? BuildAllowancesPayload(bool deliverToDoor)
  {
    return deliverToDoor
      ? [new JuraAllowancePayload(JuraDeliveryConstants.DoorToDoorAllowanceId, 1)]
      : null;
  }

  private static JuraCreateAllowancePayload[]? BuildCreateAllowancesPayload(bool deliverToDoor)
  {
    return deliverToDoor
      ? [new JuraCreateAllowancePayload(
          JuraDeliveryConstants.DoorToDoorAllowanceId,
          1,
          "custom_type",
          "Увеличить стоимость")]
      : null;
  }

  private static string AppendAllowancesQuery(string query, bool deliverToDoor)
  {
    var payload = BuildAllowancesPayload(deliverToDoor);
    if (payload is null)
      return query;

    var json = JsonSerializer.Serialize(payload, JsonOptions);
    return $"{query}&allowances={Uri.EscapeDataString(json)}";
  }

  private sealed record JuraAllowancePayload(int AllowanceId, int Value);
  private sealed record JuraCreateAllowancePayload(int Id, decimal Price, string Type, string Name);

  private object BuildCreateOrderPayload(
    JuraAddress from,
    JuraAddress to,
    int tariffId,
    string? normalizedPhone,
    bool deliverToDoor,
    long? payTypeId) => new
    {
      division_id = _options.DivisionId,
      tariff_id = tariffId,
      phone = normalizedPhone,
      pay_type_id = payTypeId,
      from_address = ToJuraAddressPayload(from),
      to_address = new[] { ToJuraAddressPayload(to) },
      allowances = BuildCreateAllowancesPayload(deliverToDoor)
    };

  // ─── Active Orders ───

  public async Task<List<JuraActiveOrder>> GetActiveOrdersAsync(string clientPhone, CancellationToken ct)
  {
    var normalizedPhone = NormalizeJuraPhone(clientPhone);
    if (string.IsNullOrEmpty(normalizedPhone))
      return [];

    var response = await SendWithAuthAsync(
      HttpMethod.Get,
      $"{ExternalOrdersBasePath}/active-order?phone={Uri.EscapeDataString(normalizedPhone)}",
      null,
      ct,
      ensureSuccess: false,
      ignoreNotFoundFailure: true);

    if (response.StatusCode == HttpStatusCode.NotFound)
      return [];

    response.EnsureSuccessStatusCode();

    var result = await ReadJuraListAsync<JuraActiveOrderData>(response, ct);
    return result.Select(o => new JuraActiveOrder
    {
      OrderId = o.Id != 0 ? o.Id : o.OrderId,
      DivisionId = o.DivisionId,
      StatusId = o.StatusId,
      Status = o.Status ?? string.Empty,
      ClientStatus = o.ClientStatus,
      TariffId = o.TariffId,
      Tariff = o.Tariff ?? string.Empty,
      Distance = o.Distance,
      Amount = o.Prices?.Amount ?? 0,
      RecipientCode = o.RecipientCode,
      PerformerDeviceId = o.Performer?.TraccarDeviceId
    }).ToList();
  }

  private async Task<long?> ResolveCorporatePayTypeIdAsync(CancellationToken ct, bool forceRefresh = false)
  {
    var fallbackPayTypeId = _options.DefaultPayTypeId > 0 ? _options.DefaultPayTypeId : (long?)null;
    if (!forceRefresh && fallbackPayTypeId.HasValue)
      return fallbackPayTypeId;

    if (!forceRefresh && _corporatePayTypeId.HasValue)
      return _corporatePayTypeId;

    await _payTypeLock.WaitAsync(ct);
    try
    {
      if (!forceRefresh && fallbackPayTypeId.HasValue)
        return fallbackPayTypeId;

      if (!forceRefresh && _corporatePayTypeId.HasValue)
        return _corporatePayTypeId;

      var response = await SendWithAuthAsync(
        HttpMethod.Get,
        $"{ExternalOrdersBasePath}/pay-types",
        null,
        ct,
        ensureSuccess: false,
        ignoreNotFoundFailure: true);

      if (!response.IsSuccessStatusCode)
      {
        _logger.LogWarning(
          "JURA pay-types endpoint returned {Status}; falling back to configured pay_type_id {PayTypeId}.",
          (int)response.StatusCode,
          fallbackPayTypeId);
        _corporatePayTypeId = fallbackPayTypeId;
        return _corporatePayTypeId;
      }

      var responseText = await response.Content.ReadAsStringAsync(ct);
      try
      {
        var payTypes = DeserializeJuraList<JuraPayTypeData>(responseText);
        _corporatePayTypeId = FindCorporatePayTypeId(payTypes) ?? fallbackPayTypeId;
      }
      catch (JsonException ex)
      {
        _logger.LogWarning(
          ex,
          "JURA pay-types endpoint returned an unexpected payload; falling back to configured pay_type_id {PayTypeId}.",
          fallbackPayTypeId);
        _corporatePayTypeId = fallbackPayTypeId;
      }

      _logger.LogInformation("Resolved JURA corporate pay_type_id: {PayTypeId}", _corporatePayTypeId);
      return _corporatePayTypeId;
    }
    finally
    {
      _payTypeLock.Release();
    }
  }

  // ─── Pay Types ───

  public async Task<List<JuraPayType>> GetPayTypesAsync(CancellationToken ct)
  {
    var response = await SendWithAuthAsync(
      HttpMethod.Get,
      $"{ExternalOrdersBasePath}/pay-types",
      null,
      ct);

    var result = await ReadJuraListAsync<JuraPayTypeData>(response, ct);
    return result.Select(p => new JuraPayType
    {
      Id = p.Id != 0 ? p.Id : p.PayTypeId,
      Type = p.Type ?? string.Empty,
      Text = p.Text ?? p.Name ?? string.Empty,
      ColType = p.ColType
    }).ToList();
  }

  private static long? FindCorporatePayTypeId(List<JuraPayTypeData> payTypes)
  {
    foreach (var payType in payTypes)
    {
      if (IsCompanyBalancePayType(payType))
        return payType.Id != 0 ? payType.Id : payType.PayTypeId;
    }

    foreach (var payType in payTypes)
    {
      if (IsCorporatePayType(payType))
        return payType.Id != 0 ? payType.Id : payType.PayTypeId;
    }

    return null;
  }

  private static bool IsCompanyBalancePayType(JuraPayTypeData payType)
  {
    return string.Equals(payType.Type, "CompanyBalance", StringComparison.OrdinalIgnoreCase)
           || string.Equals(payType.Name, "CompanyBalance", StringComparison.OrdinalIgnoreCase)
           || string.Equals(payType.Text, "CompanyBalance", StringComparison.OrdinalIgnoreCase);
  }

  private static bool IsCorporatePayType(JuraPayTypeData payType)
  {
    var candidate = string.Join(' ', payType.Type, payType.Name, payType.Text).ToLowerInvariant();
    return candidate.Contains("companybalance", StringComparison.Ordinal)
           || candidate.Contains("company balance", StringComparison.Ordinal)
           || candidate.Contains("corporate", StringComparison.Ordinal)
           || candidate.Contains("corp", StringComparison.Ordinal)
           || candidate.Contains("корпоратив", StringComparison.Ordinal)
           || candidate.Contains("корп.", StringComparison.Ordinal);
  }

  // ─── Allowances ───

  public async Task<List<JuraAllowance>> GetAllowancesAsync(int? tariffId, CancellationToken ct)
  {
    var effectiveTariffId = tariffId ?? _options.DefaultTariffId;
    var response = await SendWithAuthAsync(
      HttpMethod.Get,
      $"{ExternalOrdersBasePath}/allowances?tariff_id={effectiveTariffId}",
      null,
      ct);

    var result = await ReadJuraListAsync<JuraAllowanceData>(response, ct);
    return result.Select(a => new JuraAllowance
    {
      AllowanceId = a.AllowanceId,
      Price = a.Price,
      Type = a.Type ?? string.Empty,
      IsFixPrice = a.IsFixPrice == 1,
      Name = a.Name ?? string.Empty,
      Icon = a.Icon ?? string.Empty
    }).ToList();
  }

  private static async Task<List<T>> ReadJuraListAsync<T>(HttpResponseMessage response, CancellationToken ct)
  {
    var responseText = await response.Content.ReadAsStringAsync(ct);
    return DeserializeJuraList<T>(responseText);
  }

  private static List<T> DeserializeJuraList<T>(string responseText)
  {
    if (string.IsNullOrWhiteSpace(responseText))
      return [];

    using var document = JsonDocument.Parse(responseText);
    var listElement = document.RootElement;

    if (document.RootElement.ValueKind == JsonValueKind.Object)
    {
      if (document.RootElement.TryGetProperty("result", out var result))
        listElement = result;
      else if (document.RootElement.TryGetProperty("data", out var data))
        listElement = data;
    }

    if (listElement.ValueKind != JsonValueKind.Array)
      return [];

    return JsonSerializer.Deserialize<List<T>>(listElement.GetRawText(), JsonOptions) ?? [];
  }

  private static async Task<bool> HasValidationErrorAsync(
    HttpResponseMessage response,
    string fieldName,
    CancellationToken ct)
  {
    if (response.StatusCode != HttpStatusCode.UnprocessableEntity)
      return false;

    var responseText = await response.Content.ReadAsStringAsync(ct);
    response.Content = new StringContent(
      responseText,
      System.Text.Encoding.UTF8,
      response.Content.Headers.ContentType?.MediaType ?? "application/json");

    return responseText.Contains($"\"{fieldName}\"", StringComparison.OrdinalIgnoreCase);
  }

  // ─── Order Status ───

  public async Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(
      HttpMethod.Get,
      $"{ExternalOrdersBasePath}/status?order_id={juraOrderId}",
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
    var response = await SendWithAuthAsync(
      HttpMethod.Get,
      $"{ExternalTraccarBasePath}/position?device_id={deviceId}",
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
      $"{ExternalOrdersBasePath}/cancel?order_id={juraOrderId}&reason_cancel_order={Uri.EscapeDataString(reason)}",
      null, ct);
  }

  // ─── Receipt Code ───

  public async Task<string?> GetReceiptCodeAsync(long juraOrderId, CancellationToken ct)
  {
    var response = await SendWithAuthAsync(HttpMethod.Get,
      $"{ExternalOrdersBasePath}/receipt-code?order_id={juraOrderId}", null, ct);

    var result = await response.Content.ReadFromJsonAsync<JuraReceiptCodeResponse>(JsonOptions, ct);
    return result?.Data?.ReceiptCode ?? result?.ReceiptCode;
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

  private sealed class JuraCityData
  {
    public int Id { get; set; }
    [JsonPropertyName("baseId")]
    public string? BaseId { get; set; }
    public string? Name { get; set; }
    public string? Region { get; set; }
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
    public JuraCreateOrderResponse? Result { get; set; }
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

  private sealed class JuraActiveOrderData
  {
    public long Id { get; set; }
    public long OrderId { get; set; }
    public int DivisionId { get; set; }
    public int StatusId { get; set; }
    public string? Status { get; set; }
    public int? ClientStatus { get; set; }
    public int TariffId { get; set; }
    public string? Tariff { get; set; }
    public double Distance { get; set; }
    public string? RecipientCode { get; set; }
    public JuraPriceData? Prices { get; set; }
    public JuraPerformerData? Performer { get; set; }
  }

  private sealed class JuraPriceData
  {
    public decimal Amount { get; set; }
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

  private sealed class JuraPayTypeData
  {
    public long Id { get; set; }
    public long PayTypeId { get; set; }
    public string? Type { get; set; }
    public string? Name { get; set; }
    public string? Text { get; set; }
    public bool ColType { get; set; }
  }

  private sealed class JuraAllowanceData
  {
    public int AllowanceId { get; set; }
    public decimal Price { get; set; }
    public string? Type { get; set; }
    public int IsFixPrice { get; set; }
    public string? Name { get; set; }
    public string? Icon { get; set; }
  }

  private sealed class JuraReceiptCodeResponse
  {
    public JuraReceiptCodeResponse? Data { get; set; }
    public long OrderId { get; set; }
    public string? ReceiptCode { get; set; }
  }
}
