namespace Yalla.Infrastructure.Sms;

public static class OsonSmsPhoneNumberNormalizer
{
  public static string NormalizeForProvider(string phoneNumber)
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
}
