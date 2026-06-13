using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Route("api/connect")]
[AllowAnonymous]
[EnableRateLimiting("partner-connect")]
public sealed partial class ConnectController : ControllerBase
{
  private readonly IConfiguration _configuration;
  private readonly IHttpClientFactory _httpClientFactory;
  private readonly ILogger<ConnectController> _logger;

  public ConnectController(
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    ILogger<ConnectController> logger)
  {
    ArgumentNullException.ThrowIfNull(configuration);
    ArgumentNullException.ThrowIfNull(httpClientFactory);
    ArgumentNullException.ThrowIfNull(logger);

    _configuration = configuration;
    _httpClientFactory = httpClientFactory;
    _logger = logger;
  }

  [HttpPost]
  public async Task<IActionResult> CreatePartnerRequest(
    [FromBody] PartnerConnectRequest? request,
    CancellationToken cancellationToken)
  {
    if (!TryValidateRequest(request, out var validationProblem))
      return validationProblem;
    var validRequest = request!;

    var botToken = FirstConfiguredValue(
      _configuration["TELEGRAM_BOT_TOKEN"],
      _configuration["PartnerConnect:TelegramBotToken"]);
    var chatId = FirstConfiguredValue(
      _configuration["TELEGRAM_CHAT_ID"],
      _configuration["PartnerConnect:TelegramChatId"]);

    if (string.IsNullOrWhiteSpace(botToken) || string.IsNullOrWhiteSpace(chatId))
    {
      _logger.LogWarning("Partner connect Telegram settings are missing.");
      return Problem(
        statusCode: StatusCodes.Status500InternalServerError,
        title: "Telegram integration is not configured.");
    }

    var text = string.Join("\n", new[]
    {
      "<b>Новая заявка на подключение Yalla Pharm</b>",
      "",
      $"<b>Имя и фамилия:</b> {EscapeHtml(validRequest.FullName.Trim())}",
      $"<b>Телефон:</b> {EscapeHtml(validRequest.Phone.Trim())}",
      $"<b>Аптека:</b> {EscapeHtml(validRequest.PharmacyName.Trim())}",
      $"<b>1С в аптеке:</b> {(validRequest.HasOneC ? "Да" : "Нет")}"
    });

    var httpClient = _httpClientFactory.CreateClient();
    httpClient.Timeout = TimeSpan.FromSeconds(20);

    using var response = await httpClient.PostAsJsonAsync(
      $"https://api.telegram.org/bot{botToken}/sendMessage",
      new TelegramSendMessageRequest(chatId, "HTML", text),
      cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
      var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
      _logger.LogWarning(
        "Partner connect Telegram send failed. Status={Status}, Body={Body}",
        (int)response.StatusCode,
        responseBody);

      return Problem(
        statusCode: StatusCodes.Status502BadGateway,
        title: "Telegram message was not sent.");
    }

    return Ok(new { ok = true });
  }

  private static bool TryValidateRequest(
    PartnerConnectRequest? request,
    out IActionResult validationProblem)
  {
    var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
    var fullName = request?.FullName.Trim() ?? string.Empty;
    var phone = request?.Phone.Trim() ?? string.Empty;
    var pharmacyName = request?.PharmacyName.Trim() ?? string.Empty;

    if (string.IsNullOrWhiteSpace(fullName) || !FullNamePattern().IsMatch(fullName))
      errors[nameof(request.FullName)] = ["Invalid full name."];

    if (string.IsNullOrWhiteSpace(phone) || !PhonePattern().IsMatch(phone))
      errors[nameof(request.Phone)] = ["Invalid phone number."];

    if (string.IsNullOrWhiteSpace(pharmacyName))
      errors[nameof(request.PharmacyName)] = ["Pharmacy name is required."];

    if (errors.Count == 0)
    {
      validationProblem = new EmptyResult();
      return true;
    }

    validationProblem = new BadRequestObjectResult(new ValidationProblemDetails(errors)
    {
      Status = StatusCodes.Status400BadRequest,
      Title = "Request validation failed."
    });
    return false;
  }

  private static string EscapeHtml(string value) => WebUtility.HtmlEncode(value);

  private static string FirstConfiguredValue(params string?[] values)
    => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

  [GeneratedRegex(@"^[\p{L}\s]+$", RegexOptions.CultureInvariant)]
  private static partial Regex FullNamePattern();

  [GeneratedRegex(@"^\d+$", RegexOptions.CultureInvariant)]
  private static partial Regex PhonePattern();

  public sealed class PartnerConnectRequest
  {
    public string FullName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string PharmacyName { get; init; } = string.Empty;
    public bool HasOneC { get; init; }
  }

  private sealed record TelegramSendMessageRequest(
    [property: JsonPropertyName("chat_id")] string ChatId,
    [property: JsonPropertyName("parse_mode")] string ParseMode,
    [property: JsonPropertyName("text")] string Text);
}
