using Yalla.Infrastructure.Audit;

namespace Api.Middleware;

/// <summary>
/// Stamps every incoming request with a Guid correlation id stored in
/// <c>HttpContext.Items</c> and echoed back via <c>X-Correlation-Id</c>.
/// Downstream code (AuditLogger, ILogger scope) reads it to group every
/// side-effect of a single HTTP request together.
///
/// If the caller already sent <c>X-Correlation-Id</c> with a valid Guid
/// we adopt it — useful for end-to-end tracing across the SPA + the
/// backend (the frontend can stamp the same id on retries to make a
/// failed-then-succeeded sequence visible).
/// </summary>
public sealed class CorrelationIdMiddleware
{
  /// <summary>Key used both in HttpContext.Items and in the response
  /// header. Kept in sync with <see cref="HttpCurrentUserContext"/>.</summary>
  public const string ItemsKey = "Yalla.CorrelationId";
  public const string HeaderName = "X-Correlation-Id";

  private readonly RequestDelegate _next;

  public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

  public async Task Invoke(HttpContext context)
  {
    Guid correlationId;
    var incoming = context.Request.Headers[HeaderName].ToString();
    if (!Guid.TryParse(incoming, out correlationId))
      correlationId = Guid.NewGuid();

    context.Items[ItemsKey] = correlationId;
    context.Response.Headers[HeaderName] = correlationId.ToString();

    await _next(context);
  }
}
