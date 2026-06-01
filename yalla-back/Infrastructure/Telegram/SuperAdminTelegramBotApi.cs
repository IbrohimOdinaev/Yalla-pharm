using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

public sealed class SuperAdminTelegramBotApi : ISuperAdminTelegramBotApi
{
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
  {
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
  };

  private readonly HttpClient _http;
  private readonly SuperAdminTelegramNotificationOptions _options;
  private readonly ILogger<SuperAdminTelegramBotApi> _logger;

  public SuperAdminTelegramBotApi(
    HttpClient http,
    IOptions<SuperAdminTelegramNotificationOptions> options,
    ILogger<SuperAdminTelegramBotApi> logger)
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

  public async Task<TelegramSentMessage> SendConfirmationPromptAsync(
    long chatId,
    string text,
    string confirmCallbackData,
    string cancelCallbackData,
    string confirmButtonText,
    string cancelButtonText,
    CancellationToken cancellationToken = default)
  {
    var body = new SendMessageRequest
    {
      ChatId = chatId,
      Text = text,
      ReplyMarkup = new InlineKeyboardMarkup
      {
        InlineKeyboard =
        [
          [
            new InlineKeyboardButton { Text = confirmButtonText, CallbackData = confirmCallbackData },
            new InlineKeyboardButton { Text = cancelButtonText, CallbackData = cancelCallbackData }
          ]
        ]
      }
    };

    var result = await CallAsync<MessageDto>("sendMessage", body, cancellationToken)
      ?? throw new InvalidOperationException("SuperAdmin Telegram sendMessage returned null result.");

    return new TelegramSentMessage(result.Chat?.Id ?? chatId, result.MessageId);
  }

  public async Task EditMessageTextAsync(long chatId, int messageId, string newText, CancellationToken cancellationToken = default)
  {
    var body = new EditMessageTextRequest
    {
      ChatId = chatId,
      MessageId = messageId,
      Text = newText,
      ReplyMarkup = null
    };
    await CallAsync<JsonElement>("editMessageText", body, cancellationToken);
  }

  public async Task AnswerCallbackQueryAsync(
    string callbackQueryId,
    string? text = null,
    bool showAlert = false,
    CancellationToken cancellationToken = default)
  {
    var body = new AnswerCallbackQueryRequest
    {
      CallbackQueryId = callbackQueryId,
      Text = text,
      ShowAlert = showAlert
    };
    await CallAsync<JsonElement>("answerCallbackQuery", body, cancellationToken);
  }

  public async Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
  {
    var body = new SendMessageRequest { ChatId = chatId, Text = text };
    await CallAsync<JsonElement>("sendMessage", body, cancellationToken);
  }

  public async Task SetWebhookAsync(string url, string secretToken, CancellationToken cancellationToken = default)
  {
    var body = new SetWebhookRequest
    {
      Url = url,
      SecretToken = secretToken,
      AllowedUpdates = ["message", "callback_query"]
    };
    await CallAsync<JsonElement>("setWebhook", body, cancellationToken);
  }

  private async Task<TResult?> CallAsync<TResult>(string method, object body, CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(_options.BotToken))
      throw new InvalidOperationException("SuperAdmin Telegram BotToken is not configured.");

    var url = $"https://api.telegram.org/bot{_options.BotToken}/{method}";

    using var response = await _http.PostAsJsonAsync(url, body, JsonOptions, cancellationToken);
    var raw = await response.Content.ReadAsStringAsync(cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning(
        "SuperAdmin Telegram bot API call failed. Status={Status}, Body={Body}",
        (int)response.StatusCode,
        raw);
      throw new InvalidOperationException($"SuperAdmin Telegram bot API returned HTTP {(int)response.StatusCode}: {raw}");
    }

    var envelope = JsonSerializer.Deserialize<TelegramResponseEnvelope<TResult>>(raw, JsonOptions);
    if (envelope is null || !envelope.Ok)
    {
      var description = envelope?.Description ?? raw;
      _logger.LogWarning("SuperAdmin Telegram bot API responded with error. Description={Description}", description);
      throw new InvalidOperationException($"SuperAdmin Telegram bot API error: {description}");
    }

    return envelope.Result;
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
    public InlineKeyboardMarkup? ReplyMarkup { get; init; }
  }

  private sealed class EditMessageTextRequest
  {
    public long ChatId { get; init; }
    public int MessageId { get; init; }
    public string Text { get; init; } = string.Empty;
    public InlineKeyboardMarkup? ReplyMarkup { get; init; }
  }

  private sealed class AnswerCallbackQueryRequest
  {
    public string CallbackQueryId { get; init; } = string.Empty;
    public string? Text { get; init; }
    public bool ShowAlert { get; init; }
  }

  private sealed class SetWebhookRequest
  {
    public string Url { get; init; } = string.Empty;
    public string SecretToken { get; init; } = string.Empty;
    public string[]? AllowedUpdates { get; init; }
  }

  private sealed class InlineKeyboardMarkup
  {
    public InlineKeyboardButton[][] InlineKeyboard { get; init; } = [];
  }

  private sealed class InlineKeyboardButton
  {
    public string Text { get; init; } = string.Empty;
    public string? CallbackData { get; init; }
  }

  private sealed class MessageDto
  {
    [JsonPropertyName("message_id")] public int MessageId { get; init; }
    [JsonPropertyName("chat")] public ChatDto? Chat { get; init; }
  }

  private sealed class ChatDto
  {
    [JsonPropertyName("id")] public long Id { get; init; }
  }
}
