using System.Text.Json.Serialization;

namespace Yalla.Infrastructure.Telegram;

/// <summary>Minimal DTOs for the parts of Telegram <c>Update</c> we actually consume.</summary>
public sealed class TelegramUpdate
{
  [JsonPropertyName("update_id")] public long UpdateId { get; set; }
  [JsonPropertyName("message")] public TelegramMessage? Message { get; set; }
  [JsonPropertyName("callback_query")] public TelegramCallbackQuery? CallbackQuery { get; set; }
}

public sealed class TelegramMessage
{
  [JsonPropertyName("message_id")] public int MessageId { get; set; }
  [JsonPropertyName("chat")] public TelegramChat? Chat { get; set; }
  [JsonPropertyName("from")] public TelegramUser? From { get; set; }
  [JsonPropertyName("text")] public string? Text { get; set; }
}

public sealed class TelegramCallbackQuery
{
  [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
  [JsonPropertyName("from")] public TelegramUser? From { get; set; }
  [JsonPropertyName("message")] public TelegramMessage? Message { get; set; }
  [JsonPropertyName("data")] public string? Data { get; set; }
}

public sealed class TelegramChat
{
  [JsonPropertyName("id")] public long Id { get; set; }
}

public sealed class TelegramUser
{
  [JsonPropertyName("id")] public long Id { get; set; }
  [JsonPropertyName("username")] public string? Username { get; set; }
  [JsonPropertyName("first_name")] public string? FirstName { get; set; }
  [JsonPropertyName("last_name")] public string? LastName { get; set; }
}
