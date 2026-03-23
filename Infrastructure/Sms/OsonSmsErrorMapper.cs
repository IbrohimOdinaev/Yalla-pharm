using System.Net;

namespace Yalla.Infrastructure.Sms;

internal static class OsonSmsErrorMapper
{
  public static OsonMappedError Map(HttpStatusCode statusCode, string? providerCode, string? providerMessage)
  {
    var normalizedCode = Normalize(providerCode);
    var normalizedMessage = Normalize(providerMessage);

    if (normalizedCode is "108")
      return new OsonMappedError("duplicate_txn_id", normalizedMessage ?? "Duplicate txn_id.", false);

    if (statusCode == HttpStatusCode.Conflict)
      return new OsonMappedError("duplicate_txn_id", normalizedMessage ?? "Duplicate txn_id.", false);

    if (statusCode == HttpStatusCode.TooManyRequests
      || ContainsAny(normalizedCode, "limit", "429")
      || ContainsAny(normalizedMessage, "limit", "too many"))
    {
      return new OsonMappedError("provider_limit", normalizedMessage ?? "Provider rate limit exceeded.", true);
    }

    if ((int)statusCode >= 500)
      return new OsonMappedError("unknown_provider_error", normalizedMessage ?? "Provider internal error.", true);

    if (!string.IsNullOrWhiteSpace(normalizedCode) || !string.IsNullOrWhiteSpace(normalizedMessage))
      return new OsonMappedError("provider_reject", normalizedMessage ?? "Provider rejected request.", false);

    if ((int)statusCode is >= 400 and <= 499)
      return new OsonMappedError("provider_reject", "Provider rejected request.", false);

    return new OsonMappedError("unknown_provider_error", "Unknown provider error.", true);
  }

  private static string? Normalize(string? value)
  {
    if (string.IsNullOrWhiteSpace(value))
      return null;

    return value.Trim();
  }

  private static bool ContainsAny(string? value, params string[] items)
  {
    if (string.IsNullOrWhiteSpace(value))
      return false;

    return items.Any(item => value.Contains(item, StringComparison.OrdinalIgnoreCase));
  }
}

internal sealed record OsonMappedError(
  string ErrorCode,
  string ErrorMessage,
  bool IsTransient);
