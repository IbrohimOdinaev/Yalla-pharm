using Microsoft.Extensions.Options;
using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class TelegramServiceTests
{
    private sealed record DummyMessage : MessageBase;

    [Fact]
    public async Task SendAsync_WhenMessageIsNull_ShouldThrowArgumentNullException()
    {
        TelegramService service = new(
            new TestOptionsMonitor<TelegramConfig>(new TelegramConfig { BotToken = "token", FixedChatId = 1 }),
            new Mock<IOrderRepository>().Object);

        await Assert.ThrowsAsync<ArgumentNullException>(() => service.SendAsync(null!, CancellationToken.None));
    }

    [Fact]
    public async Task SendAsync_WhenMessageIsNotTelegramMessage_ShouldThrowArgumentException()
    {
        TelegramService service = new(
            new TestOptionsMonitor<TelegramConfig>(new TelegramConfig { BotToken = "token", FixedChatId = 1 }),
            new Mock<IOrderRepository>().Object);

        DummyMessage message = new()
        {
            Text = "hello",
            Type = MessageType.Telegram,
        };

        await Assert.ThrowsAsync<ArgumentException>(() => service.SendAsync(message, CancellationToken.None));
    }

    [Fact]
    public async Task SendAsync_WhenMessageTypeIsNotTelegram_ShouldThrowArgumentException()
    {
        TelegramService service = new(
            new TestOptionsMonitor<TelegramConfig>(new TelegramConfig { BotToken = "token", FixedChatId = 1 }),
            new Mock<IOrderRepository>().Object);

        TelegramMessage message = new()
        {
            ChatId = 1,
            Text = "hello",
            Type = MessageType.Sms,
        };

        await Assert.ThrowsAsync<ArgumentException>(() => service.SendAsync(message, CancellationToken.None));
    }
}
