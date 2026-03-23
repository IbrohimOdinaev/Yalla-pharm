using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Yalla.Infrastructure.Sms;

public sealed class OsonHashSigner : IOsonSmsRequestSigner
{
  public OsonSmsAuthMode Mode => OsonSmsAuthMode.Hash;

  public bool IsConfigured(OsonSmsOptions options, out string errorMessage)
  {
    ArgumentNullException.ThrowIfNull(options);

    if (string.IsNullOrWhiteSpace(options.Login))
    {
      errorMessage = "OsonSms.Login is required for hash mode.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(options.Sender))
    {
      errorMessage = "OsonSms.Sender is required for hash mode.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(options.PassSaltHash))
    {
      errorMessage = "OsonSms.PassSaltHash is required for hash mode.";
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

    queryParameters.Add(("t", string.IsNullOrWhiteSpace(options.T) ? "23" : options.T.Trim()));

    if (!context.IsSendRequest || context.SendCommand is null)
      return;

    var phoneNumber = context.NormalizedPhoneNumber ?? string.Empty;
    var delimiter = string.IsNullOrWhiteSpace(options.Delimiter) ? ";" : options.Delimiter;
    var payload = string.Concat(
      context.SendCommand.TxnId.Trim(),
      delimiter,
      options.Login.Trim(),
      delimiter,
      options.Sender.Trim(),
      delimiter,
      phoneNumber,
      delimiter,
      options.PassSaltHash.Trim());

    queryParameters.Add(("str_hash", ComputeSha256(payload)));
  }

  private static string ComputeSha256(string value)
  {
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
    var stringBuilder = new StringBuilder(bytes.Length * 2);
    foreach (var item in bytes)
      stringBuilder.Append(item.ToString("x2", CultureInfo.InvariantCulture));

    return stringBuilder.ToString();
  }
}
