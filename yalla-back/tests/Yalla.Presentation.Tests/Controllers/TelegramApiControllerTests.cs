using Telegram.Bot.Types;
using Yalla.Presentation.Tests.Helpers;

namespace Yalla.Presentation.Tests.Controllers;

public sealed class TelegramApiControllerTests
{
    [Fact]
    public void Get_WhenCalled_ShouldReturnExpectedMessage()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        TelegramReportBotService reportBotService = new(
            orderRepositoryMock.Object,
            new TestOptionsMonitor<TelegramReportBotConfig>(new TelegramReportBotConfig { BotToken = "dummy-token" }));
        TelegramApiController controller = new(reportBotService);

        string result = controller.Get();

        Assert.Equal("TelegramBot bot was started", result);
    }

    [Fact]
    public async Task Post_WhenUpdateHasNoMessage_ShouldCompleteSuccessfully()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        TelegramReportBotService reportBotService = new(
            orderRepositoryMock.Object,
            new TestOptionsMonitor<TelegramReportBotConfig>(new TelegramReportBotConfig { BotToken = "dummy-token" }));
        TelegramApiController controller = new(reportBotService);

        await controller.Post(new Update(), CancellationToken.None);

        Assert.True(true);
    }

    [Fact]
    public async Task Post_WhenUpdateIsNull_ShouldThrowNullReferenceException()
    {
        Mock<IOrderRepository> orderRepositoryMock = new();
        TelegramReportBotService reportBotService = new(
            orderRepositoryMock.Object,
            new TestOptionsMonitor<TelegramReportBotConfig>(new TelegramReportBotConfig { BotToken = "dummy-token" }));
        TelegramApiController controller = new(reportBotService);

        await Assert.ThrowsAsync<NullReferenceException>(() => controller.Post(null!, CancellationToken.None));
    }
}
