using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public sealed class TelegramAuthServiceTests
{
  [Fact]
  public async Task StartAsync_ReturnsHttpsDeepLinkAndKeepsAppDeepLink()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope.Db, "@YallaTestBot ");

    var response = await service.StartAsync();

    Assert.Equal("YallaTestBot", response.BotUsername);
    Assert.StartsWith("https://t.me/YallaTestBot?start=auth_", response.DeepLink);
    Assert.StartsWith("tg://resolve?domain=YallaTestBot&start=auth_", response.AppDeepLink);
    Assert.Contains(response.Nonce, response.DeepLink, StringComparison.Ordinal);
    Assert.Contains(response.Nonce, response.AppDeepLink, StringComparison.Ordinal);
  }

  private static TelegramAuthService CreateService(Yalla.Infrastructure.AppDbContext db, string botUsername)
    => new(
      db,
      new FakeTelegramBot(),
      new FakeTelegramRealtimePublisher(),
      new FakeJwtTokenProvider(),
      Options.Create(new TelegramAuthOptions
      {
        BotToken = "token",
        BotUsername = botUsername,
        AuthSessionTtlSeconds = 300
      }),
      NullLogger<TelegramAuthService>.Instance);

  private sealed class FakeTelegramBot : ITelegramBotApi
  {
    public Task<TelegramSentMessage> SendConfirmationPromptAsync(
      long chatId,
      string text,
      string confirmCallbackData,
      string cancelCallbackData,
      string confirmButtonText,
      string cancelButtonText,
      CancellationToken cancellationToken = default)
      => Task.FromResult(new TelegramSentMessage(chatId, 1));

    public Task EditMessageTextAsync(long chatId, int messageId, string newText, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task AnswerCallbackQueryAsync(string callbackQueryId, string? text = null, bool showAlert = false, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task SetWebhookAsync(string url, string secretToken, CancellationToken cancellationToken = default)
      => Task.CompletedTask;
  }

  private sealed class FakeTelegramRealtimePublisher : ITelegramAuthRealtimePublisher
  {
    public Task PublishConfirmedAsync(string nonce, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task PublishCancelledAsync(string nonce, CancellationToken cancellationToken = default)
      => Task.CompletedTask;
  }

  private sealed class FakeJwtTokenProvider : IJwtTokenProvider
  {
    public (string AccessToken, DateTime ExpiresAtUtc) GenerateToken(
      Guid userId,
      string name,
      string phoneNumber,
      Role role,
      Guid? pharmacyId = null)
      => ("token", DateTime.UtcNow.AddHours(1));
  }
}
