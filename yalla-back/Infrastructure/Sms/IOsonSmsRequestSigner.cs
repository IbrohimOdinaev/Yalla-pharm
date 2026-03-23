namespace Yalla.Infrastructure.Sms;

public interface IOsonSmsRequestSigner
{
  OsonSmsAuthMode Mode { get; }

  bool IsConfigured(OsonSmsOptions options, out string errorMessage);

  void Apply(
    HttpRequestMessage request,
    List<(string Key, string Value)> queryParameters,
    OsonSmsOptions options,
    OsonRequestSigningContext context);
}
