namespace Yalla.Domain.Exceptions;

public sealed class ClientErrorException : DomainException
{
  public ClientErrorException(
    string errorCode,
    string detail,
    string? reason = null,
    int statusCode = 400,
    string title = "Request Failed")
    : base(detail)
  {
    if (string.IsNullOrWhiteSpace(errorCode))
      throw new ArgumentException("ErrorCode can't be null or whitespace.", nameof(errorCode));

    if (string.IsNullOrWhiteSpace(detail))
      throw new ArgumentException("Detail can't be null or whitespace.", nameof(detail));

    if (statusCode < 400 || statusCode > 599)
      throw new ArgumentOutOfRangeException(nameof(statusCode), "StatusCode must be in range 400..599.");

    ErrorCode = errorCode.Trim();
    Detail = detail.Trim();
    Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    StatusCode = statusCode;
    Title = string.IsNullOrWhiteSpace(title) ? "Request Failed" : title.Trim();
  }

  public string ErrorCode { get; }

  public string Detail { get; }

  public string? Reason { get; }

  public int StatusCode { get; }

  public string Title { get; }
}
