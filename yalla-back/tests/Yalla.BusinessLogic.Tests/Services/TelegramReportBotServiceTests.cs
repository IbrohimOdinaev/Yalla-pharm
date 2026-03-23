using Telegram.Bot.Types;
using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class TelegramReportBotServiceTests
{
    [Fact]
    public async Task SendReportAsync_WhenUpdateHasNoMessage_ShouldCompleteSuccessfully()
    {
        TelegramReportBotService service = new(
            new Mock<IOrderRepository>().Object,
            new TestOptionsMonitor<TelegramReportBotConfig>(new TelegramReportBotConfig { BotToken = "token" }));

        Update update = new();

        await service.SendReportAsync(update, CancellationToken.None);
    }
}
