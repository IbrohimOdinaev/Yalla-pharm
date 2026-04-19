using System.Globalization;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public sealed class StubPaymentService : IPaymentService
{
  private const string DeclineEnvName = "YALLA_STUB_PAYMENT_DECLINE";
  private readonly DushanbeCityPaymentOptions _paymentOptions;
  private readonly IPaymentSettingsService _paymentSettingsService;

  public StubPaymentService(IOptions<DushanbeCityPaymentOptions> paymentOptions, IPaymentSettingsService paymentSettingsService)
  {
    ArgumentNullException.ThrowIfNull(paymentOptions);
    ArgumentNullException.ThrowIfNull(paymentSettingsService);
    _paymentOptions = paymentOptions.Value;
    _paymentSettingsService = paymentSettingsService;
  }

  public async Task<PayForOrderResponse> PayForOrderAsync(
    PayForOrderRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.Amount <= 0)
    {
      return new PayForOrderResponse
      {
        IsPaid = false,
        Provider = _paymentOptions.ProviderName,
        Status = "Declined",
        FailureReason = "Payment amount must be positive."
      };
    }

    var rawDeclineFlag = Environment.GetEnvironmentVariable(DeclineEnvName);
    var shouldDecline = string.Equals(rawDeclineFlag, "1", StringComparison.OrdinalIgnoreCase)
      || string.Equals(rawDeclineFlag, "true", StringComparison.OrdinalIgnoreCase);

    if (shouldDecline)
    {
      return new PayForOrderResponse
      {
        IsPaid = false,
        Provider = _paymentOptions.ProviderName,
        Status = "Declined",
        FailureReason = $"Stub payment was declined via env var '{DeclineEnvName}'."
      };
    }

    var paymentLink = await BuildPaymentLinkAsync(request, cancellationToken);

    return new PayForOrderResponse
    {
      IsPaid = true,
      Provider = _paymentOptions.ProviderName,
      Status = "PendingManualConfirmation",
      TransactionId = $"stub-{Guid.NewGuid():N}",
      PaymentUrl = paymentLink.PaymentUrl,
      PaymentComment = paymentLink.PaymentComment,
      ReceiverAccount = paymentLink.ReceiverAccount
    };
  }

  private async Task<PaymentLinkInfo> BuildPaymentLinkAsync(PayForOrderRequest request, CancellationToken cancellationToken)
  {
    // Prefer the runtime-editable URL from the DB; fall back to static config.
    var overrideUrl = await _paymentSettingsService.GetDcBaseUrlAsync(cancellationToken);
    var baseUrl = !string.IsNullOrWhiteSpace(overrideUrl) ? overrideUrl : _paymentOptions.BaseUrl;

    if (string.IsNullOrWhiteSpace(baseUrl))
    {
      return new PaymentLinkInfo
      {
        PaymentComment = $"ClientNumber: {NormalizePhoneNumber(request.ClientPhoneNumber)} & OrderId: {request.OrderId}",
        ReceiverAccount = string.Empty
      };
    }

    var amount = request.Amount.ToString("0.00", CultureInfo.InvariantCulture);
    var clientPhoneNumber = NormalizePhoneNumber(request.ClientPhoneNumber);
    var paymentComment = $"ClientNumber: {clientPhoneNumber} & OrderId: {request.OrderId}";
    var paymentUrl = WithQueryParameter(
      WithQueryParameter(baseUrl, "s", amount),
      "c",
      paymentComment);

    return new PaymentLinkInfo
    {
      PaymentUrl = paymentUrl,
      PaymentComment = paymentComment,
      ReceiverAccount = TryGetQueryParameter(paymentUrl, "A") ?? string.Empty
    };
  }

  private static string NormalizePhoneNumber(string? phoneNumber)
  {
    if (string.IsNullOrWhiteSpace(phoneNumber))
      return "unknown";

    var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());
    if (digitsOnly.StartsWith("992", StringComparison.Ordinal) && digitsOnly.Length == 12)
      return digitsOnly[3..];

    return digitsOnly.Length > 0 ? digitsOnly : phoneNumber.Trim();
  }

  private static string WithQueryParameter(string url, string key, string value)
  {
    var source = url ?? string.Empty;
    var fragmentIndex = source.IndexOf('#');
    var fragment = fragmentIndex >= 0 ? source[fragmentIndex..] : string.Empty;
    var withoutFragment = fragmentIndex >= 0 ? source[..fragmentIndex] : source;

    var queryIndex = withoutFragment.IndexOf('?');
    var path = queryIndex >= 0 ? withoutFragment[..queryIndex] : withoutFragment;
    var query = queryIndex >= 0 ? withoutFragment[(queryIndex + 1)..] : string.Empty;

    var parameters = ParseQuery(query);
    parameters[key] = value;

    var rebuiltQuery = string.Join(
      "&",
      parameters.Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value)}"));

    return rebuiltQuery.Length == 0
      ? $"{path}{fragment}"
      : $"{path}?{rebuiltQuery}{fragment}";
  }

  private static Dictionary<string, string> ParseQuery(string query)
  {
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (string.IsNullOrWhiteSpace(query))
      return result;

    foreach (var segment in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
      var equalsIndex = segment.IndexOf('=');
      if (equalsIndex < 0)
      {
        var keyWithoutValue = Uri.UnescapeDataString(segment);
        if (!string.IsNullOrWhiteSpace(keyWithoutValue))
          result[keyWithoutValue] = string.Empty;

        continue;
      }

      var key = Uri.UnescapeDataString(segment[..equalsIndex]);
      if (string.IsNullOrWhiteSpace(key))
        continue;

      var encodedValue = segment[(equalsIndex + 1)..];
      result[key] = Uri.UnescapeDataString(encodedValue);
    }

    return result;
  }

  private static string? TryGetQueryParameter(string? url, string key)
  {
    if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(key))
      return null;

    var queryIndex = url.IndexOf('?');
    if (queryIndex < 0 || queryIndex == url.Length - 1)
      return null;

    var query = url[(queryIndex + 1)..];
    var parameters = ParseQuery(query);
    return parameters.TryGetValue(key, out var value) ? value : null;
  }

  private sealed class PaymentLinkInfo
  {
    public string? PaymentUrl { get; init; }
    public string PaymentComment { get; init; } = string.Empty;
    public string ReceiverAccount { get; init; } = string.Empty;
  }
}
