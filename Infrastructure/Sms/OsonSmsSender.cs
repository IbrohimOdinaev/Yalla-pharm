using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Sms;

public sealed class OsonSmsSender : ISmsSender
{
  private readonly HttpClient _httpClient;
  private readonly OsonSmsOptions _options;
  private readonly IReadOnlyDictionary<OsonSmsAuthMode, IOsonSmsRequestSigner> _signers;
  private readonly ILogger<OsonSmsSender> _logger;

  public OsonSmsSender(
    HttpClient httpClient,
    IOptions<OsonSmsOptions> options,
    IEnumerable<IOsonSmsRequestSigner> signers,
    ILogger<OsonSmsSender> logger)
  {
    ArgumentNullException.ThrowIfNull(httpClient);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(signers);
    ArgumentNullException.ThrowIfNull(logger);

    _httpClient = httpClient;
    _options = options.Value;
    _signers = signers.ToDictionary(x => x.Mode);
    _logger = logger;
  }

  public async Task<SmsSendResult> SendSmsAsync(
    SmsSendCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    if (!TryResolveSigner(out var signer, out var configErrorResult))
      return configErrorResult;

    if (!signer.IsConfigured(_options, out var signerConfigError))
    {
      return new SmsSendResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "config_invalid",
        ErrorMessage = signerConfigError
      };
    }

    if (string.IsNullOrWhiteSpace(command.TxnId))
    {
      return new SmsSendResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "config_invalid",
        ErrorMessage = "TxnId is required."
      };
    }

    var normalizedPhone = OsonSmsPhoneNumberNormalizer.NormalizeForProvider(command.PhoneNumber);
    if (string.IsNullOrWhiteSpace(normalizedPhone))
    {
      return new SmsSendResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "provider_reject",
        ErrorMessage = "Phone number is invalid for provider."
      };
    }

    var maxRetries = Math.Max(0, _options.MaxRetryAttempts);
    var backoffSeconds = Math.Max(1, _options.RetryBackoffSeconds);
    SmsSendResult? lastResult = null;

    for (var attempt = 0; attempt <= maxRetries; attempt++)
    {
      var queryParameters = new List<(string Key, string Value)>
      {
        ("from", _options.Sender.Trim()),
        ("phone_number", normalizedPhone),
        ("msg", command.Message),
        ("login", _options.Login.Trim()),
        ("txn_id", command.TxnId.Trim()),
        ("is_confidential", command.IsConfidential || _options.IsConfidential ? "true" : "false")
      };

      using var request = new HttpRequestMessage(HttpMethod.Get, "/sendsms_v1.php");
      signer.Apply(
        request,
        queryParameters,
        _options,
        new OsonRequestSigningContext
        {
          IsSendRequest = true,
          SendCommand = command,
          NormalizedPhoneNumber = normalizedPhone
        });
      request.RequestUri = new Uri($"/sendsms_v1.php?{BuildQuery(queryParameters)}", UriKind.Relative);

      try
      {
        using var timeoutCts = CreateTimeoutCancellationSource(cancellationToken);
        using var response = await _httpClient.SendAsync(request, timeoutCts.Token);
        var payload = await ReadJsonAsync(response, timeoutCts.Token);
        var providerCode = ReadErrorCode(payload);
        var providerMessage = ReadErrorMessage(payload);

        if (response.IsSuccessStatusCode && string.IsNullOrWhiteSpace(providerCode))
        {
          return new SmsSendResult
          {
            IsSuccess = true,
            StatusCode = (int)response.StatusCode,
            TxnId = ReadString(payload, "txn_id") ?? command.TxnId.Trim(),
            MsgId = ReadString(payload, "msg_id")
          };
        }

        var mappedError = OsonSmsErrorMapper.Map(response.StatusCode, providerCode, providerMessage);
        lastResult = new SmsSendResult
        {
          IsSuccess = false,
          StatusCode = (int)response.StatusCode,
          TxnId = ReadString(payload, "txn_id") ?? command.TxnId.Trim(),
          MsgId = ReadString(payload, "msg_id"),
          ErrorCode = mappedError.ErrorCode,
          ErrorMessage = mappedError.ErrorMessage
        };

        if (!mappedError.IsTransient || attempt >= maxRetries)
          return lastResult;

        var delay = CalculateBackoff(attempt, backoffSeconds);
        _logger.LogWarning(
          "OsonSms transient send error, retry scheduled. TxnId={TxnId}, Attempt={Attempt}, RetryAfterSeconds={RetryAfterSeconds}, ErrorCode={ErrorCode}",
          command.TxnId,
          attempt + 1,
          delay.TotalSeconds,
          mappedError.ErrorCode);
        await Task.Delay(delay, cancellationToken);
      }
      catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
      {
        lastResult = new SmsSendResult
        {
          IsSuccess = false,
          StatusCode = 0,
          TxnId = command.TxnId.Trim(),
          ErrorCode = "transport_error",
          ErrorMessage = "SMS provider timeout."
        };

        if (attempt >= maxRetries)
          return lastResult;

        var delay = CalculateBackoff(attempt, backoffSeconds);
        _logger.LogWarning(
          "OsonSms timeout, retry scheduled. TxnId={TxnId}, Attempt={Attempt}, RetryAfterSeconds={RetryAfterSeconds}",
          command.TxnId,
          attempt + 1,
          delay.TotalSeconds);
        await Task.Delay(delay, cancellationToken);
      }
      catch (OperationCanceledException)
      {
        throw;
      }
      catch (Exception exception)
      {
        _logger.LogError(
          exception,
          "OsonSms transport error while sending SMS. TxnId={TxnId}, Attempt={Attempt}",
          command.TxnId,
          attempt + 1);

        lastResult = new SmsSendResult
        {
          IsSuccess = false,
          StatusCode = 0,
          TxnId = command.TxnId.Trim(),
          ErrorCode = "transport_error",
          ErrorMessage = "SMS provider transport error."
        };

        if (attempt >= maxRetries)
          return lastResult;

        await Task.Delay(CalculateBackoff(attempt, backoffSeconds), cancellationToken);
      }
    }

    return lastResult ?? new SmsSendResult
    {
      IsSuccess = false,
      StatusCode = 0,
      TxnId = command.TxnId.Trim(),
      ErrorCode = "unknown_provider_error",
      ErrorMessage = "Unknown SMS send failure."
    };
  }

  public async Task<SmsDeliveryVerificationResult> VerifySmsAsync(
    SmsDeliveryVerificationCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    if (!TryResolveSigner(out var signer, out var configErrorResult))
      return new SmsDeliveryVerificationResult
      {
        IsSuccess = false,
        StatusCode = configErrorResult.StatusCode,
        ErrorCode = configErrorResult.ErrorCode,
        ErrorMessage = configErrorResult.ErrorMessage
      };

    if (!signer.IsConfigured(_options, out var signerConfigError))
    {
      return new SmsDeliveryVerificationResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "config_invalid",
        ErrorMessage = signerConfigError
      };
    }

    var queryParameters = new List<(string Key, string Value)>
    {
      ("login", _options.Login.Trim())
    };

    if (!string.IsNullOrWhiteSpace(command.MsgId))
      queryParameters.Add(("msg_id", command.MsgId.Trim()));

    if (!string.IsNullOrWhiteSpace(command.TxnId))
      queryParameters.Add(("txn_id", command.TxnId.Trim()));

    try
    {
      using var request = new HttpRequestMessage(HttpMethod.Get, "/query_sms.php");
      signer.Apply(
        request,
        queryParameters,
        _options,
        new OsonRequestSigningContext
        {
          IsSendRequest = false,
          VerifyCommand = command
        });
      request.RequestUri = new Uri($"/query_sms.php?{BuildQuery(queryParameters)}", UriKind.Relative);

      using var timeoutCts = CreateTimeoutCancellationSource(cancellationToken);
      using var response = await _httpClient.SendAsync(request, timeoutCts.Token);
      var payload = await ReadJsonAsync(response, timeoutCts.Token);
      var providerCode = ReadErrorCode(payload);
      var providerMessage = ReadErrorMessage(payload);
      var mappedError = OsonSmsErrorMapper.Map(response.StatusCode, providerCode, providerMessage);
      var isSuccess = response.IsSuccessStatusCode && string.IsNullOrWhiteSpace(providerCode);

      return new SmsDeliveryVerificationResult
      {
        IsSuccess = isSuccess,
        StatusCode = (int)response.StatusCode,
        DeliveryStatus = ReadString(payload, "status"),
        ErrorCode = isSuccess ? null : mappedError.ErrorCode,
        ErrorMessage = isSuccess ? null : mappedError.ErrorMessage
      };
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
      return new SmsDeliveryVerificationResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "transport_error",
        ErrorMessage = "SMS provider timeout."
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
        StatusCode = 0,
        ErrorCode = "transport_error",
        ErrorMessage = "SMS provider transport error."
      };
    }
  }

  private static async Task<JsonElement?> ReadJsonAsync(
    HttpResponseMessage response,
    CancellationToken cancellationToken)
  {
    var raw = await response.Content.ReadAsStringAsync(cancellationToken);
    if (string.IsNullOrWhiteSpace(raw))
      return null;

    try
    {
      using var document = JsonDocument.Parse(raw);
      return document.RootElement.Clone();
    }
    catch (JsonException)
    {
      return null;
    }
  }

  private static string BuildQuery(IEnumerable<(string Key, string Value)> pairs)
  {
    return string.Join(
      "&",
      pairs.Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value)}"));
  }

  private bool TryResolveSigner(out IOsonSmsRequestSigner signer, out SmsSendResult errorResult)
  {
    if (!TryParseAuthMode(_options.AuthMode, out var mode))
    {
      signer = default!;
      errorResult = new SmsSendResult
      {
        IsSuccess = false,
        StatusCode = 0,
        ErrorCode = "config_invalid",
        ErrorMessage = $"Unsupported OsonSms.AuthMode '{_options.AuthMode}'. Allowed: Bearer, Hash."
      };
      return false;
    }

    if (_signers.TryGetValue(mode, out signer!))
    {
      errorResult = new SmsSendResult
      {
        IsSuccess = true
      };
      return true;
    }

    errorResult = new SmsSendResult
    {
      IsSuccess = false,
      StatusCode = 0,
      ErrorCode = "config_invalid",
      ErrorMessage = $"Signer for OsonSms.AuthMode '{mode}' is not registered."
    };
    return false;
  }

  private static bool TryParseAuthMode(string? rawMode, out OsonSmsAuthMode mode)
  {
    if (Enum.TryParse<OsonSmsAuthMode>(rawMode?.Trim(), ignoreCase: true, out mode))
      return true;

    mode = OsonSmsAuthMode.Bearer;
    return false;
  }

  private CancellationTokenSource CreateTimeoutCancellationSource(CancellationToken cancellationToken)
  {
    var timeoutSeconds = Math.Max(5, _options.TimeoutSeconds);
    var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    cts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
    return cts;
  }

  private static TimeSpan CalculateBackoff(int attempt, int backoffSeconds)
  {
    var multiplier = Math.Pow(2, attempt);
    return TimeSpan.FromSeconds(backoffSeconds * multiplier);
  }

  private static string? ReadErrorCode(JsonElement? payload)
  {
    if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
      return null;

    if (!payload.Value.TryGetProperty("error", out var errorNode))
      return null;

    return ReadString(errorNode, "code");
  }

  private static string? ReadErrorMessage(JsonElement? payload)
  {
    if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
      return null;

    if (!payload.Value.TryGetProperty("error", out var errorNode))
      return null;

    return ReadString(errorNode, "msg");
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
