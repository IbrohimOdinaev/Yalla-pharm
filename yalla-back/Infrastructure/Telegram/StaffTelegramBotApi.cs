using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

public sealed class StaffTelegramBotApi : IStaffTelegramBotApi
{
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
  {
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
  };

  private readonly HttpClient _http;
  private readonly StaffTelegramNotificationOptions _options;
  private readonly ILogger<StaffTelegramBotApi> _logger;

  public StaffTelegramBotApi(
    HttpClient http,
    IOptions<StaffTelegramNotificationOptions> options,
    ILogger<StaffTelegramBotApi> logger)
  {
    ArgumentNullException.ThrowIfNull(http);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _http = http;
    _options = options.Value;
    _logger = logger;

    if (_http.BaseAddress is null)
      _http.BaseAddress = new Uri("https://api.telegram.org/");
    _http.Timeout = TimeSpan.FromSeconds(20);
  }

  public async Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(_options.BotToken))
      throw new InvalidOperationException("Staff Telegram BotToken is not configured.");

    var body = new SendMessageRequest { ChatId = chatId, Text = text };
    var url = $"https://api.telegram.org/bot{_options.BotToken}/sendMessage";

    using var response = await _http.PostAsJsonAsync(url, body, JsonOptions, cancellationToken);
    var raw = await response.Content.ReadAsStringAsync(cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning(
        "Staff Telegram bot API call failed. Status={Status}, Body={Body}",
        (int)response.StatusCode,
        raw);
      throw new InvalidOperationException($"Staff Telegram bot API returned HTTP {(int)response.StatusCode}: {raw}");
    }

    var envelope = JsonSerializer.Deserialize<TelegramResponseEnvelope<JsonElement>>(raw, JsonOptions);
    if (envelope is null || !envelope.Ok)
    {
      var description = envelope?.Description ?? raw;
      _logger.LogWarning("Staff Telegram bot API responded with error. Description={Description}", description);
      throw new InvalidOperationException($"Staff Telegram bot API error: {description}");
    }
  }

  private sealed class TelegramResponseEnvelope<T>
  {
    [JsonPropertyName("ok")] public bool Ok { get; init; }
    [JsonPropertyName("description")] public string? Description { get; init; }
    [JsonPropertyName("result")] public T? Result { get; init; }
  }

  private sealed class SendMessageRequest
  {
    public long ChatId { get; init; }
    public string Text { get; init; } = string.Empty;
  }
}
