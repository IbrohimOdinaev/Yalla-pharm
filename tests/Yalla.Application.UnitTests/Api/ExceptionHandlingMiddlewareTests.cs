using System.Text.Json;
using Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Api;

public sealed class ExceptionHandlingMiddlewareTests
{
  [Theory]
  [MemberData(nameof(GetMappedExceptions))]
  public async Task InvokeAsync_ForMappedExceptions_ShouldReturnSanitizedProblemDetails(
    Exception exception,
    int expectedStatusCode,
    string expectedTitle,
    string expectedDetail,
    string expectedErrorCode,
    LogLevel expectedLogLevel)
  {
    var logger = new TestLogger<ExceptionHandlingMiddleware>();
    var middleware = new ExceptionHandlingMiddleware(_ => throw exception, logger);
    var context = CreateContext();

    await middleware.InvokeAsync(context);

    Assert.Equal(expectedStatusCode, context.Response.StatusCode);
    Assert.StartsWith("application/json", context.Response.ContentType, StringComparison.OrdinalIgnoreCase);

    var payload = await ReadProblemDetailsAsync(context);
    Assert.Equal(expectedStatusCode, payload.Status);
    Assert.Equal(expectedTitle, payload.Title);
    Assert.Equal(expectedDetail, payload.Detail);
    Assert.Equal(expectedErrorCode, payload.ErrorCode);
    Assert.Equal(context.TraceIdentifier, payload.TraceId);
    Assert.DoesNotContain("SECRET", payload.Detail ?? string.Empty);
    Assert.DoesNotContain("SECRET", await ReadRawBodyAsync(context));

    Assert.Single(logger.Entries);
    Assert.Equal(expectedLogLevel, logger.Entries[0].Level);
  }

  [Fact]
  public async Task InvokeAsync_ForUnhandledException_ShouldReturn500AndLogError()
  {
    var logger = new TestLogger<ExceptionHandlingMiddleware>();
    var middleware = new ExceptionHandlingMiddleware(
      _ => throw new Exception("SECRET_DB_CONNECTION_STRING"),
      logger);
    var context = CreateContext();

    await middleware.InvokeAsync(context);

    Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);

    var payload = await ReadProblemDetailsAsync(context);
    Assert.Equal("Internal Server Error", payload.Title);
    Assert.Equal("Внутренняя ошибка сервера.", payload.Detail);
    Assert.Equal("internal_error", payload.ErrorCode);
    Assert.Equal(context.TraceIdentifier, payload.TraceId);
    Assert.DoesNotContain("SECRET", await ReadRawBodyAsync(context));

    Assert.Single(logger.Entries);
    Assert.Equal(LogLevel.Error, logger.Entries[0].Level);
    Assert.Contains("internal_error", logger.Entries[0].Message, StringComparison.Ordinal);
  }

  [Fact]
  public async Task InvokeAsync_WhenResponseAlreadyStarted_ShouldRethrowAndNotRewriteResponse()
  {
    var logger = new TestLogger<ExceptionHandlingMiddleware>();
    var middleware = new ExceptionHandlingMiddleware(
      _ =>
      {
        throw new InvalidOperationException("SECRET_AFTER_START");
      },
      logger);

    var context = CreateStartedContext();

    var thrown = await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));
    Assert.Equal("SECRET_AFTER_START", thrown.Message);

    Assert.Single(logger.Entries);
    Assert.Equal(LogLevel.Warning, logger.Entries[0].Level);
    Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    Assert.Equal(string.Empty, await ReadRawBodyAsync(context));
  }

  [Fact]
  public async Task InvokeAsync_ForClientErrorException_ShouldReturnCustomCodeAndReason()
  {
    var logger = new TestLogger<ExceptionHandlingMiddleware>();
    var middleware = new ExceptionHandlingMiddleware(
      _ => throw new ClientErrorException(
        errorCode: "sms_code_invalid",
        detail: "Код подтверждения введен неверно.",
        reason: "invalid_code",
        statusCode: 422,
        title: "SMS Verification Failed"),
      logger);
    var context = CreateContext();

    await middleware.InvokeAsync(context);

    Assert.Equal(422, context.Response.StatusCode);
    var payload = await ReadProblemDetailsAsync(context);
    Assert.Equal(422, payload.Status);
    Assert.Equal("SMS Verification Failed", payload.Title);
    Assert.Equal("Код подтверждения введен неверно.", payload.Detail);
    Assert.Equal("sms_code_invalid", payload.ErrorCode);
    Assert.Equal("invalid_code", payload.Reason);
    Assert.Equal(LogLevel.Warning, logger.Entries.Single().Level);
  }

  public static IEnumerable<object[]> GetMappedExceptions()
  {
    yield return
    [
      new DomainArgumentException("SECRET_VALIDATION"),
      StatusCodes.Status400BadRequest,
      "Request Failed",
      "Некорректные данные запроса.",
      "validation_error",
      LogLevel.Warning
    ];
    yield return
    [
      new ConflictException("SECRET_CONFLICT"),
      StatusCodes.Status409Conflict,
      "Request Failed",
      "Конфликт состояния. Обновите данные и повторите попытку.",
      "conflict",
      LogLevel.Warning
    ];
    yield return
    [
      new DomainException("SECRET_DOMAIN"),
      StatusCodes.Status400BadRequest,
      "Request Failed",
      "Операция не может быть выполнена в текущем состоянии.",
      "domain_error",
      LogLevel.Warning
    ];
    yield return
    [
      new InvalidOperationException("SECRET_INVALID"),
      StatusCodes.Status400BadRequest,
      "Request Failed",
      "Операция не может быть выполнена в текущем состоянии.",
      "invalid_operation",
      LogLevel.Warning
    ];
    yield return
    [
      new UnauthorizedAccessException("SECRET_AUTH"),
      StatusCodes.Status401Unauthorized,
      "Request Failed",
      "Требуется авторизация.",
      "unauthorized",
      LogLevel.Warning
    ];
    yield return
    [
      new OperationCanceledException("SECRET_CANCEL"),
      499,
      "Request Failed",
      "Запрос был отменен.",
      "request_canceled",
      LogLevel.Information
    ];
  }

  private static DefaultHttpContext CreateContext()
  {
    var context = new DefaultHttpContext();
    context.Request.Method = HttpMethods.Post;
    context.Request.Path = "/api/test-endpoint";
    context.Response.Body = new MemoryStream();
    return context;
  }

  private static DefaultHttpContext CreateStartedContext()
  {
    var context = new DefaultHttpContext();
    context.Features.Set<IHttpResponseFeature>(new StartedHttpResponseFeature());
    context.Request.Method = HttpMethods.Post;
    context.Request.Path = "/api/test-endpoint";
    context.Response.Body = new MemoryStream();
    return context;
  }

  private static async Task<ProblemDetailsPayload> ReadProblemDetailsAsync(HttpContext context)
  {
    context.Response.Body.Position = 0;
    using var document = await JsonDocument.ParseAsync(context.Response.Body);
    var root = document.RootElement;

    return new ProblemDetailsPayload
    {
      Status = root.GetProperty("status").GetInt32(),
      Title = root.GetProperty("title").GetString(),
      Detail = root.GetProperty("detail").GetString(),
      TraceId = root.GetProperty("traceId").GetString(),
      ErrorCode = root.GetProperty("errorCode").GetString(),
      Reason = root.TryGetProperty("reason", out var reasonNode) ? reasonNode.GetString() : null
    };
  }

  private static async Task<string> ReadRawBodyAsync(HttpContext context)
  {
    context.Response.Body.Position = 0;
    using var reader = new StreamReader(context.Response.Body, leaveOpen: true);
    return await reader.ReadToEndAsync();
  }

  private sealed class ProblemDetailsPayload
  {
    public int Status { get; init; }
    public string? Title { get; init; }
    public string? Detail { get; init; }
    public string? TraceId { get; init; }
    public string? ErrorCode { get; init; }
    public string? Reason { get; init; }
  }

  private sealed class TestLogger<T> : ILogger<T>
  {
    public List<LogEntry> Entries { get; } = [];

    public IDisposable BeginScope<TState>(TState state)
      where TState : notnull
    {
      return NoopDisposable.Instance;
    }

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
      LogLevel logLevel,
      EventId eventId,
      TState state,
      Exception? exception,
      Func<TState, Exception?, string> formatter)
    {
      Entries.Add(new LogEntry(logLevel, formatter(state, exception), exception));
    }
  }

  private sealed record LogEntry(LogLevel Level, string Message, Exception? Exception);

  private sealed class NoopDisposable : IDisposable
  {
    public static readonly NoopDisposable Instance = new();

    public void Dispose()
    {
    }
  }

  private sealed class StartedHttpResponseFeature : IHttpResponseFeature
  {
    public int StatusCode { get; set; } = StatusCodes.Status200OK;
    public string? ReasonPhrase { get; set; }
    public IHeaderDictionary Headers { get; set; } = new HeaderDictionary();
    public Stream Body { get; set; } = new MemoryStream();
    public bool HasStarted => true;

    public void OnCompleted(Func<object, Task> callback, object state)
    {
    }

    public void OnStarting(Func<object, Task> callback, object state)
    {
    }
  }
}
