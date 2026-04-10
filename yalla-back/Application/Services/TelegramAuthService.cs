using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class TelegramAuthService : ITelegramAuthService
{
  private const string ConfirmCallbackPrefix = "tgauth:cnf:";
  private const string CancelCallbackPrefix = "tgauth:cnc:";

  private readonly IAppDbContext _dbContext;
  private readonly ITelegramBotApi _bot;
  private readonly ITelegramAuthRealtimePublisher _realtime;
  private readonly IJwtTokenProvider _jwtTokenProvider;
  private readonly TelegramAuthOptions _options;
  private readonly ILogger<TelegramAuthService> _logger;

  public TelegramAuthService(
    IAppDbContext dbContext,
    ITelegramBotApi bot,
    ITelegramAuthRealtimePublisher realtime,
    IJwtTokenProvider jwtTokenProvider,
    IOptions<TelegramAuthOptions> options,
    ILogger<TelegramAuthService> logger)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(bot);
    ArgumentNullException.ThrowIfNull(realtime);
    ArgumentNullException.ThrowIfNull(jwtTokenProvider);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _dbContext = dbContext;
    _bot = bot;
    _realtime = realtime;
    _jwtTokenProvider = jwtTokenProvider;
    _options = options.Value;
    _logger = logger;
  }

  // ─────────────────────── public API ───────────────────────

  public async Task<StartTelegramAuthResponse> StartAsync(CancellationToken cancellationToken = default)
  {
    EnsureConfigured();

    var nonce = GenerateNonce();
    var ttlSeconds = _options.AuthSessionTtlSeconds <= 0 ? 300 : _options.AuthSessionTtlSeconds;
    var expiresAtUtc = DateTime.UtcNow.AddSeconds(ttlSeconds);

    var session = new TelegramAuthSession(nonce, expiresAtUtc);
    _dbContext.TelegramAuthSessions.Add(session);
    await _dbContext.SaveChangesAsync(cancellationToken);

    // Use tg:// URI scheme — opens the Telegram app directly via OS handler.
    // This avoids DNS resolution of t.me, which may be blocked in some networks.
    var deepLink = $"tg://resolve?domain={_options.BotUsername}&start=auth_{nonce}";

    _logger.LogInformation(
      "Telegram auth session created. Nonce={Nonce}, ExpiresAtUtc={ExpiresAtUtc}",
      nonce,
      expiresAtUtc);

    return new StartTelegramAuthResponse
    {
      Nonce = nonce,
      DeepLink = deepLink,
      BotUsername = _options.BotUsername,
      ExpiresAtUtc = expiresAtUtc,
      TtlSeconds = ttlSeconds
    };
  }

  public async Task<LoginResponse> CompleteAsync(CompleteTelegramAuthRequest request, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (string.IsNullOrWhiteSpace(request.Nonce))
      throw new ClientErrorException(
        errorCode: "telegram_auth_nonce_missing",
        detail: "Nonce обязателен.",
        reason: "nonce_missing");

    var session = await _dbContext.TelegramAuthSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Nonce == request.Nonce, cancellationToken)
      ?? throw new ClientErrorException(
        errorCode: "telegram_auth_session_not_found",
        detail: "Сессия входа не найдена.",
        reason: "session_not_found");

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
    {
      session.MarkExpired();
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    if (session.Status != TelegramAuthSessionStatus.Confirmed)
      throw new ClientErrorException(
        errorCode: "telegram_auth_not_confirmed",
        detail: "Сессия не подтверждена. Откройте Telegram-бот и подтвердите вход.",
        reason: $"status:{session.Status}");

    if (session.TelegramUserId is null)
      throw new ClientErrorException(
        errorCode: "telegram_auth_payload_missing",
        detail: "Данные сессии повреждены.",
        reason: "payload_missing");

    var tgUserId = session.TelegramUserId.Value;

    // Find existing client by TelegramId
    var client = await _dbContext.Clients
      .AsTracking()
      .FirstOrDefaultAsync(x => x.TelegramId == tgUserId, cancellationToken);

    if (client is null)
    {
      var displayName = BuildDisplayName(session.TelegramFirstName, session.TelegramLastName);
      client = new Client(displayName, tgUserId, session.TelegramUsername);
      _dbContext.Clients.Add(client);
    }
    else
    {
      // Refresh username/name from latest Telegram data — username can change.
      if (!string.IsNullOrWhiteSpace(session.TelegramUsername) && client.TelegramUsername != session.TelegramUsername)
        client.SetTelegramUsername(session.TelegramUsername);
      if (string.IsNullOrWhiteSpace(client.Name))
      {
        var displayName = BuildDisplayName(session.TelegramFirstName, session.TelegramLastName);
        if (!string.IsNullOrWhiteSpace(displayName))
          client.SetName(displayName);
      }
    }

    session.Consume();
    await _dbContext.SaveChangesAsync(cancellationToken);

    var token = _jwtTokenProvider.GenerateToken(client.Id, client.Name, client.PhoneNumber, client.Role);

    return new LoginResponse
    {
      UserId = client.Id,
      Name = client.Name,
      PhoneNumber = client.PhoneNumber,
      Role = client.Role,
      AccessToken = token.AccessToken,
      ExpiresAtUtc = token.ExpiresAtUtc
    };
  }

  public async Task<PollTelegramAuthResponse> PollAsync(string nonce, CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(nonce))
      throw new ClientErrorException(
        errorCode: "telegram_auth_nonce_missing",
        detail: "Nonce обязателен.",
        reason: "nonce_missing");

    var session = await _dbContext.TelegramAuthSessions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce, cancellationToken);

    if (session is null)
      return new PollTelegramAuthResponse { Status = "expired" };

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
      return new PollTelegramAuthResponse { Status = "expired" };

    return new PollTelegramAuthResponse { Status = session.Status.ToString().ToLowerInvariant() };
  }

  // ─────────────────────── webhook handlers ───────────────────────

  public async Task HandleStartCommandAsync(
    string nonce,
    long chatId,
    long telegramUserId,
    string? username,
    string? firstName,
    string? lastName,
    CancellationToken cancellationToken = default)
  {
    var session = await _dbContext.TelegramAuthSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce, cancellationToken);

    if (session is null)
    {
      await _bot.SendMessageAsync(chatId, "Сессия входа не найдена. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.", cancellationToken);
      return;
    }

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
    {
      session.MarkExpired();
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    if (session.Status != TelegramAuthSessionStatus.Pending)
    {
      var statusText = session.Status switch
      {
        TelegramAuthSessionStatus.Confirmed => "Эта сессия уже подтверждена.",
        TelegramAuthSessionStatus.Consumed => "Этот вход уже использован.",
        TelegramAuthSessionStatus.Cancelled => "Эта сессия была отменена.",
        TelegramAuthSessionStatus.Expired => "Эта сессия истекла.",
        _ => "Сессия неактивна."
      };
      await _bot.SendMessageAsync(chatId, $"{statusText} Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.", cancellationToken);
      return;
    }

    var displayName = BuildDisplayName(firstName, lastName);
    var usernameLine = string.IsNullOrWhiteSpace(username) ? string.Empty : $"\n@{username}";
    var promptText =
      $"Подтвердите вход на yallafarm.tj\n\n" +
      $"Имя: {displayName}{usernameLine}\n\n" +
      $"Если это не вы — нажмите «Отменить».";

    var sent = await _bot.SendConfirmationPromptAsync(
      chatId,
      promptText,
      ConfirmCallbackPrefix + nonce,
      CancelCallbackPrefix + nonce,
      "✅ Подтвердить",
      "❌ Отменить",
      cancellationToken);

    session.RegisterConfirmationMessage(sent.ChatId, sent.MessageId);
    await _dbContext.SaveChangesAsync(cancellationToken);

    _logger.LogInformation(
      "Telegram auth: confirmation prompt sent. Nonce={Nonce}, TgUserId={TgUserId}",
      nonce,
      telegramUserId);
  }

  public async Task HandleConfirmCallbackAsync(
    string nonce,
    string callbackQueryId,
    long chatId,
    int messageId,
    long telegramUserId,
    string? username,
    string? firstName,
    string? lastName,
    CancellationToken cancellationToken = default)
  {
    var session = await _dbContext.TelegramAuthSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce, cancellationToken);

    if (session is null)
    {
      await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Сессия не найдена", showAlert: true, cancellationToken);
      return;
    }

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
    {
      session.MarkExpired();
      await _dbContext.SaveChangesAsync(cancellationToken);
      await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Сессия истекла", showAlert: true, cancellationToken);
      return;
    }

    if (session.Status != TelegramAuthSessionStatus.Pending)
    {
      await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Сессия уже завершена", showAlert: true, cancellationToken);
      return;
    }

    session.Confirm(telegramUserId, username, firstName, lastName);
    await _dbContext.SaveChangesAsync(cancellationToken);

    await _bot.EditMessageTextAsync(
      chatId,
      messageId,
      "✅ Готово! Вернитесь на сайт — вы будете автоматически авторизованы.",
      cancellationToken);

    await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Подтверждено", showAlert: false, cancellationToken);

    await _realtime.PublishConfirmedAsync(nonce, cancellationToken);

    _logger.LogInformation(
      "Telegram auth confirmed. Nonce={Nonce}, TgUserId={TgUserId}, Username={Username}",
      nonce,
      telegramUserId,
      username);
  }

  public async Task HandleCancelCallbackAsync(
    string nonce,
    string callbackQueryId,
    long chatId,
    int messageId,
    CancellationToken cancellationToken = default)
  {
    var session = await _dbContext.TelegramAuthSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce, cancellationToken);

    if (session is null)
    {
      await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Сессия не найдена", showAlert: true, cancellationToken);
      return;
    }

    if (session.Status == TelegramAuthSessionStatus.Pending)
    {
      session.Cancel();
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    await _bot.EditMessageTextAsync(
      chatId,
      messageId,
      "❌ Вход отменён. Вы можете вернуться на сайт и попробовать ещё раз.",
      cancellationToken);

    await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Отменено", showAlert: false, cancellationToken);

    await _realtime.PublishCancelledAsync(nonce, cancellationToken);

    _logger.LogInformation("Telegram auth cancelled. Nonce={Nonce}", nonce);
  }

  // ─────────────────────── helpers ───────────────────────

  private void EnsureConfigured()
  {
    if (string.IsNullOrWhiteSpace(_options.BotToken))
      throw new InvalidOperationException("Telegram:BotToken is not configured.");
    if (string.IsNullOrWhiteSpace(_options.BotUsername))
      throw new InvalidOperationException("Telegram:BotUsername is not configured.");
  }

  private static string GenerateNonce()
  {
    var bytes = RandomNumberGenerator.GetBytes(24); // 192 bits → 32 char base64url
    return Convert.ToBase64String(bytes)
      .Replace('+', '-')
      .Replace('/', '_')
      .TrimEnd('=');
  }

  private static string BuildDisplayName(string? firstName, string? lastName)
  {
    var fn = firstName?.Trim();
    var ln = lastName?.Trim();
    if (string.IsNullOrEmpty(fn) && string.IsNullOrEmpty(ln)) return string.Empty;
    if (string.IsNullOrEmpty(ln)) return fn ?? string.Empty;
    if (string.IsNullOrEmpty(fn)) return ln;
    return $"{fn} {ln}";
  }
}
