using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Sms;

public sealed class OsonSmsSender : ISmsSender
{
  private readonly HttpClient _httpClient;
  private readonly OsonSmsOptions _options;
  private readonly ILogger<OsonSmsSender> _logger;

  public OsonSmsSender(
    HttpClient httpClient,
    IOptions<OsonSmsOptions> options,
    ILogger<OsonSmsSender> logger)
  {
    ArgumentNullException.ThrowIfNull(httpClient);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _httpClient = httpClient;
    _options = options.Value;
    _logger = logger;
  }

  public async Task<SmsSendResult> SendSmsAsync(
    SmsSendCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    if (string.IsNullOrWhiteSpace(_options.Login)
      || string.IsNullOrWhiteSpace(_options.Token)
      || string.IsNullOrWhiteSpace(_options.Sender))
    {
      return new SmsSendResult
      {
        IsSuccess = false,
        ErrorCode = "config_invalid",
        ErrorMessage = "OsonSms credentials are not configured."
      };
    }

    var normalizedPhone = NormalizePhoneForProvider(command.PhoneNumber);
    var query = BuildQuery(
      ("from", _options.Sender),
      ("phone_number", normalizedPhone),
      ("msg", command.Message),
      ("login", _options.Login),
      ("txn_id", command.TxnId),
      ("is_confidential", command.IsConfidential || _options.IsConfidential ? "true" : "false"));

    using var request = new HttpRequestMessage(HttpMethod.Get, $"/sendsms_v1.php?{query}");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.Token);

    try
    {
      using var response = await _httpClient.SendAsync(request, cancellationToken);
      var payload = await ReadJsonAsync(response, cancellationToken);
      var error = ReadError(payload);

      return new SmsSendResult
      {
        IsSuccess = (int)response.StatusCode == 201 || (int)response.StatusCode == 409,
        StatusCode = (int)response.StatusCode,
        TxnId = ReadString(payload, "txn_id") ?? command.TxnId,
        MsgId = ReadString(payload, "msg_id"),
        ErrorCode = error.Code,
        ErrorMessage = error.Message
      };
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "OsonSms send failed for txnId={TxnId}", command.TxnId);
      return new SmsSendResult
      {
        IsSuccess = false,
        ErrorCode = "transport_error",
        ErrorMessage = exception.Message
      };
    }
  }

  public async Task<SmsDeliveryVerificationResult> VerifySmsAsync(
    SmsDeliveryVerificationCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    if (string.IsNullOrWhiteSpace(_options.Login)
      || string.IsNullOrWhiteSpace(_options.Token))
    {
      return new SmsDeliveryVerificationResult
      {
        IsSuccess = false,
        ErrorCode = "config_invalid",
        ErrorMessage = "OsonSms credentials are not configured."
      };
    }

    var queryParts = new List<(string Key, string Value)>
    {
      ("login", _options.Login)
    };

    if (!string.IsNullOrWhiteSpace(command.MsgId))
      queryParts.Add(("msg_id", command.MsgId.Trim()));

    if (!string.IsNullOrWhiteSpace(command.TxnId))
      queryParts.Add(("txn_id", command.TxnId.Trim()));

    var query = BuildQuery(queryParts.ToArray());

    using var request = new HttpRequestMessage(HttpMethod.Get, $"/query_sms.php?{query}");
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.Token);

    try
    {
      using var response = await _httpClient.SendAsync(request, cancellationToken);
      var payload = await ReadJsonAsync(response, cancellationToken);
      var error = ReadError(payload);

      return new SmsDeliveryVerificationResult
      {
        IsSuccess = response.IsSuccessStatusCode,
        StatusCode = (int)response.StatusCode,
        DeliveryStatus = ReadString(payload, "status"),
        ErrorCode = error.Code,
        ErrorMessage = error.Message
      };
    }
    catch (OperationCanceledException)
    {
      throw;
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "OsonSms delivery verification failed.");
      return new SmsDeliveryVerificationResult
      {
        IsSuccess = false,
        ErrorCode = "transport_error",
        ErrorMessage = exception.Message
      };
    }
  }

  private static async Task<JsonElement?> ReadJsonAsync(
    HttpResponseMessage response,
    CancellationToken cancellationToken)
  {
    var contentType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
    if (!contentType.Contains("json", StringComparison.OrdinalIgnoreCase))
      return null;

    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    return document.RootElement.Clone();
  }

  private static string BuildQuery(params (string Key, string Value)[] pairs)
  {
    return string.Join(
      "&",
      pairs.Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value)}"));
  }

  private static string NormalizePhoneForProvider(string phoneNumber)
  {
    var digits = string.IsNullOrWhiteSpace(phoneNumber)
      ? string.Empty
      : new string(phoneNumber.Where(char.IsDigit).ToArray());

    if (digits.StartsWith("992", StringComparison.Ordinal) && digits.Length == 12)
      return digits;

    if (digits.Length == 9)
      return $"992{digits}";

    return digits;
  }

  private static (string? Code, string? Message) ReadError(JsonElement? payload)
  {
    if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
      return (null, null);

    if (!payload.Value.TryGetProperty("error", out var errorNode))
      return (null, null);

    return (
      ReadString(errorNode, "code"),
      ReadString(errorNode, "msg"));
  }

  private static string? ReadString(JsonElement? payload, string propertyName)
  {
    if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
      return null;

    return ReadString(payload.Value, propertyName);
  }

  private static string? ReadString(JsonElement payload, string propertyName)
  {
    if (!payload.TryGetProperty(propertyName, out var value))
      return null;

    return value.ValueKind switch
    {
      JsonValueKind.String => value.GetString(),
      JsonValueKind.Number => value.GetRawText(),
      _ => null
    };
  }
}
