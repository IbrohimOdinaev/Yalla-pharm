using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

/// <summary>
/// Minimal implementation of the Telegram Bot API HTTP calls our auth flow needs.
/// Talks directly to https://api.telegram.org/bot{token}/{method} via HttpClient.
/// </summary>
public sealed class TelegramBotApi : ITelegramBotApi
{
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
  {
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
  };

  private readonly HttpClient _http;
  private readonly TelegramAuthOptions _options;
  private readonly ILogger<TelegramBotApi> _logger;

  public TelegramBotApi(
    HttpClient http,
    IOptions<TelegramAuthOptions> options,
    ILogger<TelegramBotApi> logger)
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

  // ─────────────────────── public ───────────────────────

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
        InlineKeyboard = new[]
        {
          new[]
          {
            new InlineKeyboardButton { Text = confirmButtonText, CallbackData = confirmCallbackData },
            new InlineKeyboardButton { Text = cancelButtonText, CallbackData = cancelCallbackData },
          },
        },
      },
    };

    var result = await CallAsync<MessageDto>("sendMessage", body, cancellationToken)
      ?? throw new InvalidOperationException("Telegram sendMessage returned null result.");

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

  public async Task AnswerCallbackQueryAsync(string callbackQueryId, string? text = null, bool showAlert = false, CancellationToken cancellationToken = default)
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
      AllowedUpdates = new[] { "message", "callback_query" }
    };
    await CallAsync<JsonElement>("setWebhook", body, cancellationToken);
  }

  // ─────────────────────── HTTP helper ───────────────────────

  private async Task<TResult?> CallAsync<TResult>(string method, object body, CancellationToken cancellationToken)
  {
    if (string.IsNullOrEmpty(_options.BotToken))
      throw new InvalidOperationException("Telegram BotToken is not configured.");

    // Use absolute URL — the bot token contains a ':' which HttpClient would
    // misinterpret as a URI scheme on a relative URL.
    var url = $"https://api.telegram.org/bot{_options.BotToken}/{method}";

    using var response = await _http.PostAsJsonAsync(url, body, JsonOptions, cancellationToken);
    var raw = await response.Content.ReadAsStringAsync(cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
      _logger.LogWarning("Telegram bot API call failed. Method={Method}, Status={Status}, Body={Body}",
        method, (int)response.StatusCode, raw);
      throw new InvalidOperationException($"Telegram bot API '{method}' returned HTTP {(int)response.StatusCode}: {raw}");
    }

    var envelope = JsonSerializer.Deserialize<TelegramResponseEnvelope<TResult>>(raw, JsonOptions);
    if (envelope is null || !envelope.Ok)
    {
      var description = envelope?.Description ?? raw;
      _logger.LogWarning("Telegram bot API responded with error. Method={Method}, Description={Description}", method, description);
      throw new InvalidOperationException($"Telegram bot API '{method}' error: {description}");
    }

    return envelope.Result;
  }

  // ─────────────────────── DTOs ───────────────────────

  private sealed class TelegramResponseEnvelope<T>
  {
    [JsonPropertyName("ok")] public bool Ok { get; init; }
    [JsonPropertyName("description")] public string? Description { get; init; }
    [JsonPropertyName("result")] public T? Result { get; init; }
    [JsonPropertyName("error_code")] public int? ErrorCode { get; init; }
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
    public InlineKeyboardButton[][] InlineKeyboard { get; init; } = Array.Empty<InlineKeyboardButton[]>();
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
