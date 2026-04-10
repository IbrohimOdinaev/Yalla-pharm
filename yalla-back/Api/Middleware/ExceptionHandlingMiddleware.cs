using Microsoft.AspNetCore.Mvc;
using Yalla.Domain.Exceptions;

namespace Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
  private readonly RequestDelegate _next;
  private readonly ILogger<ExceptionHandlingMiddleware> _logger;

  public ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
  {
    _next = next;
    _logger = logger;
  }

  public async Task InvokeAsync(HttpContext context)
  {
    try
    {
      await _next(context);
    }
    catch (Exception exception)
    {
      // TEMP DIAGNOSTIC: dump every exception that reaches the middleware,
      // even if response has already started.
      try
      {
        var line =
          $"[{DateTime.UtcNow:O}] {context.Request.Method} {context.Request.Path} HasStarted={context.Response.HasStarted} traceId={context.TraceIdentifier}\n" +
          exception.ToString() + "\n" +
          "----------------------------------------------------------------\n";
        System.IO.File.AppendAllText("/tmp/yalla-error.log", line);
      }
      catch { /* ignore */ }

      if (context.Response.HasStarted)
      {
        _logger.LogWarning(
          exception,
          "Unhandled exception after response started for {Method} {Path}. TraceId: {TraceId}",
          context.Request.Method,
          context.Request.Path,
          context.TraceIdentifier);

        throw;
      }

      var error = MapError(exception);
      LogException(exception, error, context);

      context.Response.Clear();
      context.Response.StatusCode = error.StatusCode;
      context.Response.ContentType = "application/json";

      var problemDetails = new ProblemDetails
      {
        Status = error.StatusCode,
        Title = error.Title,
        Detail = error.Detail
      };

      problemDetails.Extensions["traceId"] = context.TraceIdentifier;
      problemDetails.Extensions["errorCode"] = error.Code;
      if (!string.IsNullOrWhiteSpace(error.Reason))
        problemDetails.Extensions["reason"] = error.Reason;

      await context.Response.WriteAsJsonAsync(problemDetails);
    }
  }

  private static ErrorPayload MapError(Exception exception)
  {
    return exception switch
    {
      DomainArgumentException => new ErrorPayload(
        StatusCodes.Status400BadRequest,
        "Request Failed",
        "Некорректные данные запроса.",
        "validation_error",
        null),
      ClientErrorException clientError => new ErrorPayload(
        clientError.StatusCode,
        clientError.Title,
        clientError.Detail,
        clientError.ErrorCode,
        clientError.Reason),
      ConflictException => new ErrorPayload(
        StatusCodes.Status409Conflict,
        "Request Failed",
        "Конфликт состояния. Обновите данные и повторите попытку.",
        "conflict",
        null),
      DomainException => new ErrorPayload(
        StatusCodes.Status400BadRequest,
        "Request Failed",
        "Операция не может быть выполнена в текущем состоянии.",
        "domain_error",
        null),
      InvalidOperationException => new ErrorPayload(
        StatusCodes.Status400BadRequest,
        "Request Failed",
        "Операция не может быть выполнена в текущем состоянии.",
        "invalid_operation",
        null),
      UnauthorizedAccessException => new ErrorPayload(
        StatusCodes.Status401Unauthorized,
        "Request Failed",
        "Требуется авторизация.",
        "unauthorized",
        null),
      OperationCanceledException => new ErrorPayload(
        499,
        "Request Failed",
        "Запрос был отменен.",
        "request_canceled",
        null),
      _ => new ErrorPayload(
        StatusCodes.Status500InternalServerError,
        "Internal Server Error",
        "Внутренняя ошибка сервера.",
        "internal_error",
        null)
    };
  }

  private void LogException(Exception exception, ErrorPayload error, HttpContext context)
  {
    if (error.StatusCode >= 500)
    {
      _logger.LogError(
        exception,
        "Unhandled exception for {Method} {Path}. TraceId: {TraceId}. StatusCode: {StatusCode}. ErrorCode: {ErrorCode}",
        context.Request.Method,
        context.Request.Path,
        context.TraceIdentifier,
        error.StatusCode,
        error.Code);

      // TEMP DIAGNOSTIC: also dump full exception to /tmp/yalla-error.log so we can read it from outside.
      try
      {
        var line =
          $"[{DateTime.UtcNow:O}] {context.Request.Method} {context.Request.Path} traceId={context.TraceIdentifier}\n" +
          exception.ToString() + "\n" +
          "----------------------------------------------------------------\n";
        System.IO.File.AppendAllText("/tmp/yalla-error.log", line);
      }
      catch { /* ignore */ }

      return;
    }

    if (error.StatusCode == 499)
    {
      _logger.LogInformation(
        "Request canceled for {Method} {Path}. TraceId: {TraceId}. ErrorCode: {ErrorCode}",
        context.Request.Method,
        context.Request.Path,
        context.TraceIdentifier,
        error.Code);
      return;
    }

    _logger.LogWarning(
      "Handled exception for {Method} {Path}. TraceId: {TraceId}. StatusCode: {StatusCode}. ErrorCode: {ErrorCode}. ExceptionType: {ExceptionType}",
      context.Request.Method,
      context.Request.Path,
      context.TraceIdentifier,
      error.StatusCode,
      error.Code,
      exception.GetType().Name);
  }

  private sealed record ErrorPayload(
    int StatusCode,
    string Title,
    string Detail,
    string Code,
    string? Reason);
}
