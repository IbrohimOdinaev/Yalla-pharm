using System.Net.Http.Headers;

namespace Yalla.Infrastructure.Sms;

public sealed class OsonBearerSigner : IOsonSmsRequestSigner
{
  public OsonSmsAuthMode Mode => OsonSmsAuthMode.Bearer;

  public bool IsConfigured(OsonSmsOptions options, out string errorMessage)
  {
    ArgumentNullException.ThrowIfNull(options);

    if (string.IsNullOrWhiteSpace(options.Login))
    {
      errorMessage = "OsonSms.Login is required for bearer mode.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(options.Token))
    {
      errorMessage = "OsonSms.Token is required for bearer mode.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(options.Sender))
    {
      errorMessage = "OsonSms.Sender is required for bearer mode.";
      return false;
    }

    errorMessage = string.Empty;
    return true;
  }

  public void Apply(
    HttpRequestMessage request,
    List<(string Key, string Value)> queryParameters,
    OsonSmsOptions options,
    OsonRequestSigningContext context)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(queryParameters);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(context);

    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Token.Trim());
  }
}
