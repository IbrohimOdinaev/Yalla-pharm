using Yalla.Domain.Exceptions;

namespace Yalla.Application.Common;

public static class UserInputPolicy
{
  public const int MinPasswordLength = 8;
  public const long MaxMedicineImageFileSizeBytes = 50L * 1024 * 1024;

  private static readonly HashSet<char> AllowedPasswordSymbols =
  [
    '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
    '-', '_', '+', '=', '.', ',', '?'
  ];

  public static string NormalizePhoneNumber(string phoneNumber)
  {
    var validationError = ValidatePhoneNumber(phoneNumber, "PhoneNumber");
    if (validationError is not null)
      throw new DomainArgumentException(validationError);

    var normalized = phoneNumber.Trim();
    if (normalized.StartsWith('+'))
      normalized = normalized[1..];

    if (normalized.StartsWith("992", StringComparison.Ordinal) && normalized.Length == 12)
      normalized = normalized[3..];

    return normalized;
  }

  public static void EnsureValidPassword(string password, string fieldName = "Password")
  {
    var validationError = ValidatePassword(password, fieldName);
    if (validationError is not null)
      throw new DomainArgumentException(validationError);
  }

  public static string? ValidatePhoneNumber(string? phoneNumber, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(phoneNumber))
      return $"{fieldName} can't be null or whitespace.";

    var normalized = phoneNumber.Trim();
    if (normalized.StartsWith('+'))
      normalized = normalized[1..];

    if (!normalized.All(char.IsDigit))
      return $"{fieldName} must contain digits only.";

    if (normalized.StartsWith("992", StringComparison.Ordinal) && normalized.Length == 12)
      normalized = normalized[3..];

    return normalized.Length == 9
      ? null
      : $"{fieldName} must contain exactly 9 digits (without +992 prefix).";
  }

  public static string? ValidatePassword(string? password, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(password))
      return $"{fieldName} can't be null or whitespace.";

    if (password.Length < MinPasswordLength)
      return $"{fieldName} must be at least {MinPasswordLength} characters long.";

    foreach (var character in password)
    {
      if (IsAsciiLetterOrDigit(character))
        continue;

      if (!AllowedPasswordSymbols.Contains(character))
      {
        return $"{fieldName} contains unsupported characters. Use Latin letters, digits, and basic symbols only.";
      }
    }

    return null;
  }

  private static bool IsAsciiLetterOrDigit(char character)
  {
    return (character >= 'a' && character <= 'z')
      || (character >= 'A' && character <= 'Z')
      || (character >= '0' && character <= '9');
  }
}
