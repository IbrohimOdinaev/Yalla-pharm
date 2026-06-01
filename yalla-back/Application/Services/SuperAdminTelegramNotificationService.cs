using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class SuperAdminTelegramNotificationService : ISuperAdminTelegramNotificationService
{
  private const string ConfirmCallbackPrefix = "tgsuper:cnf:";
  private const string CancelCallbackPrefix = "tgsuper:cnc:";

  private readonly IAppDbContext _dbContext;
  private readonly ISuperAdminTelegramBotApi _bot;
  private readonly SuperAdminTelegramNotificationOptions _options;
  private readonly ILogger<SuperAdminTelegramNotificationService> _logger;

  public SuperAdminTelegramNotificationService(
    IAppDbContext dbContext,
    ISuperAdminTelegramBotApi bot,
    IOptions<SuperAdminTelegramNotificationOptions> options,
    ILogger<SuperAdminTelegramNotificationService> logger)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(bot);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _dbContext = dbContext;
    _bot = bot;
    _options = options.Value;
    _logger = logger;
  }

  public async Task<SuperAdminTelegramRecipientsResponse> GetRecipientsAsync(
    Guid superAdminId,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("superAdminId can't be empty.");

    var recipients = await _dbContext.SuperAdminTelegramRecipients
      .AsNoTracking()
      .Where(x => x.SuperAdminId == superAdminId && x.IsActive)
      .OrderByDescending(x => x.CreatedAtUtc)
      .Select(x => ToResponse(x))
      .ToListAsync(cancellationToken);

    return new SuperAdminTelegramRecipientsResponse { Recipients = recipients };
  }

  public async Task<StartTelegramAuthResponse> StartLinkAsync(
    Guid superAdminId,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("superAdminId can't be empty.");

    EnsureConfigured();

    var superAdminExists = await _dbContext.Users
      .AsNoTracking()
      .AnyAsync(x => x.Id == superAdminId && x.Role == Role.SuperAdmin && x.IsActive, cancellationToken);
    if (!superAdminExists)
      throw new InvalidOperationException("SuperAdmin was not found.");

    var nonce = GenerateNonce();
    var ttlSeconds = 300;
    var expiresAtUtc = DateTime.UtcNow.AddSeconds(ttlSeconds);

    var session = new TelegramAuthSession(nonce, expiresAtUtc, superAdminId);
    _dbContext.TelegramAuthSessions.Add(session);
    await _dbContext.SaveChangesAsync(cancellationToken);

    var botUsername = NormalizeBotUsername(_options.BotUsername);
    var payload = Uri.EscapeDataString($"superadmin_notify_{nonce}");

    return new StartTelegramAuthResponse
    {
      Nonce = nonce,
      DeepLink = $"tg://resolve?domain={botUsername}&start={payload}",
      AppDeepLink = $"tg://resolve?domain={botUsername}&start={payload}",
      WebDeepLink = $"https://t.me/{botUsername}?start={payload}",
      BotUsername = botUsername,
      ExpiresAtUtc = expiresAtUtc,
      TtlSeconds = ttlSeconds
    };
  }

  public async Task<PollTelegramAuthResponse> PollAsync(
    Guid superAdminId,
    string nonce,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("superAdminId can't be empty.");
    if (string.IsNullOrWhiteSpace(nonce))
      return new PollTelegramAuthResponse { Status = "expired" };

    var session = await _dbContext.TelegramAuthSessions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce && x.InitiatingUserId == superAdminId, cancellationToken);

    if (session is null)
      return new PollTelegramAuthResponse { Status = "expired" };

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
      return new PollTelegramAuthResponse { Status = "expired" };

    return new PollTelegramAuthResponse { Status = session.Status.ToString().ToLowerInvariant() };
  }

  public async Task<SuperAdminTelegramRecipientResponse> CompleteLinkAsync(
    Guid superAdminId,
    string nonce,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("superAdminId can't be empty.");
    if (string.IsNullOrWhiteSpace(nonce))
      throw new DomainArgumentException("nonce can't be empty.");

    var session = await _dbContext.TelegramAuthSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Nonce == nonce && x.InitiatingUserId == superAdminId, cancellationToken)
      ?? throw new InvalidOperationException("Telegram link session was not found.");

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
    {
      session.MarkExpired();
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    if (session.Status != TelegramAuthSessionStatus.Confirmed)
      throw new InvalidOperationException($"Telegram link session is not confirmed. Status={session.Status}.");
    if (session.TelegramUserId is null || session.ConfirmationChatId is null)
      throw new InvalidOperationException("Telegram link session payload is missing.");

    var recipient = await _dbContext.SuperAdminTelegramRecipients
      .AsTracking()
      .FirstOrDefaultAsync(
        x => x.SuperAdminId == superAdminId && x.ChatId == session.ConfirmationChatId.Value,
        cancellationToken);

    if (recipient is null)
    {
      recipient = new SuperAdminTelegramRecipient(
        superAdminId,
        session.ConfirmationChatId.Value,
        session.TelegramUserId.Value,
        session.TelegramUsername,
        session.TelegramFirstName,
        session.TelegramLastName);
      _dbContext.SuperAdminTelegramRecipients.Add(recipient);
    }
    else
    {
      recipient.RefreshTelegramProfile(
        session.TelegramUsername,
        session.TelegramFirstName,
        session.TelegramLastName);
    }

    session.Consume();
    await _dbContext.SaveChangesAsync(cancellationToken);

    return ToResponse(recipient);
  }

  public async Task DeleteRecipientAsync(
    Guid superAdminId,
    Guid recipientId,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("superAdminId can't be empty.");
    if (recipientId == Guid.Empty)
      throw new DomainArgumentException("recipientId can't be empty.");

    var recipient = await _dbContext.SuperAdminTelegramRecipients
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == recipientId && x.SuperAdminId == superAdminId, cancellationToken)
      ?? throw new InvalidOperationException("Telegram recipient was not found.");

    recipient.Deactivate();
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

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
      await _bot.SendMessageAsync(chatId, "Сессия привязки не найдена. Вернитесь в профиль и попробуйте ещё раз.", cancellationToken);
      return;
    }

    if (session.Status == TelegramAuthSessionStatus.Pending && session.ExpiresAtUtc <= DateTime.UtcNow)
    {
      session.MarkExpired();
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    if (session.Status != TelegramAuthSessionStatus.Pending)
    {
      await _bot.SendMessageAsync(chatId, "Эта сессия уже неактивна. Вернитесь в профиль и попробуйте ещё раз.", cancellationToken);
      return;
    }

    var displayName = BuildDisplayName(firstName, lastName);
    var usernameLine = string.IsNullOrWhiteSpace(username) ? string.Empty : $"\n@{username}";
    var promptText =
      "Подключить этот Telegram для уведомлений SuperAdmin Yalla Pharm?\n\n" +
      $"Аккаунт: {displayName}{usernameLine}\n\n" +
      "На этот чат будут приходить новые заказы, запросы на рецепт, отмены и возвраты.";

    var sent = await _bot.SendConfirmationPromptAsync(
      chatId,
      promptText,
      ConfirmCallbackPrefix + nonce,
      CancelCallbackPrefix + nonce,
      "Подключить",
      "Отмена",
      cancellationToken);

    session.RegisterConfirmationMessage(sent.ChatId, sent.MessageId);
    await _dbContext.SaveChangesAsync(cancellationToken);
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

    session.RegisterConfirmationMessage(chatId, messageId);
    session.Confirm(telegramUserId, username, firstName, lastName);
    await _dbContext.SaveChangesAsync(cancellationToken);

    await _bot.EditMessageTextAsync(
      chatId,
      messageId,
      "Готово. Вернитесь в панель SuperAdmin, привязка завершится автоматически.",
      cancellationToken);
    await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Подключено", showAlert: false, cancellationToken);

    _logger.LogInformation(
      "SuperAdmin Telegram link confirmed. Nonce={Nonce}, TgUserId={TgUserId}",
      nonce,
      telegramUserId);
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

    await _bot.EditMessageTextAsync(chatId, messageId, "Привязка отменена.", cancellationToken);
    await _bot.AnswerCallbackQueryAsync(callbackQueryId, "Отменено", showAlert: false, cancellationToken);
  }

  private void EnsureConfigured()
  {
    if (string.IsNullOrWhiteSpace(NormalizeBotUsername(_options.BotUsername)))
      throw new ClientErrorException(
        errorCode: "superadmin_telegram_bot_username_missing",
        detail: "Telegram-бот для уведомлений SuperAdmin не настроен: отсутствует BotUsername.",
        reason: "bot_username_missing");
  }

  private static SuperAdminTelegramRecipientResponse ToResponse(SuperAdminTelegramRecipient recipient)
    => new()
    {
      Id = recipient.Id,
      TelegramUserId = recipient.TelegramUserId,
      TelegramUsername = recipient.TelegramUsername,
      TelegramFirstName = recipient.TelegramFirstName,
      TelegramLastName = recipient.TelegramLastName,
      IsActive = recipient.IsActive,
      CreatedAtUtc = recipient.CreatedAtUtc
    };

  private static string NormalizeBotUsername(string? botUsername)
    => (botUsername ?? string.Empty).Trim().TrimStart('@');

  private static string GenerateNonce()
  {
    var bytes = RandomNumberGenerator.GetBytes(24);
    return Convert.ToBase64String(bytes)
      .Replace('+', '-')
      .Replace('/', '_')
      .TrimEnd('=');
  }

  private static string BuildDisplayName(string? firstName, string? lastName)
  {
    var fn = firstName?.Trim();
    var ln = lastName?.Trim();
    if (string.IsNullOrEmpty(fn) && string.IsNullOrEmpty(ln)) return "Telegram";
    if (string.IsNullOrEmpty(ln)) return fn ?? "Telegram";
    if (string.IsNullOrEmpty(fn)) return ln;
    return $"{fn} {ln}";
  }
}
