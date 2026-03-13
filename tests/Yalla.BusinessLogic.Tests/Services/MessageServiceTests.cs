using Microsoft.Extensions.Options;
using Yalla.BusinessLogic.Tests.TestInfrastructure;

namespace Yalla.BusinessLogic.Tests.Services;

public sealed class MessageServiceTests
{
    [Fact]
    public async Task SendAsync_WhenOrderIsNull_ShouldReturnFalse()
    {
        Mock<ICourierMessageService> courierMessageService = new();
        Mock<ICustomerMessageService> customerMessageService = new();
        Mock<ITelegramService> telegramService = new();
        Mock<IPharmacyMessageService> pharmacyMessageService = new();

        MessageService service = new(
            courierMessageService.Object,
            customerMessageService.Object,
            telegramService.Object,
            pharmacyMessageService.Object,
            new Mock<IOrderRepository>().Object,
            new TestOptionsMonitor<OsonSmsConfig>(new OsonSmsConfig { OsonSmsUrl = "https://oson.test" }));

        bool result = await service.SendAsync(null!, smsMailing: false, CancellationToken.None);

        Assert.False(result);
        telegramService.VerifyNoOtherCalls();
        customerMessageService.VerifyNoOtherCalls();
        courierMessageService.VerifyNoOtherCalls();
        pharmacyMessageService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SendAsync_WhenOrderIsValidAndSmsMailingDisabled_ShouldSendTwoTelegramMessages()
    {
        Mock<ICourierMessageService> courierMessageService = new();
        Mock<ICustomerMessageService> customerMessageService = new();
        Mock<ITelegramService> telegramService = new();
        Mock<IPharmacyMessageService> pharmacyMessageService = new();

        CancellationToken cancellationToken = new CancellationTokenSource().Token;

        customerMessageService
            .Setup(x => x.CreateTelegramMessage(It.IsAny<OrderDataForMessageResponse>()))
            .Returns(new TelegramMessage { ChatId = 1, Text = "customer", Type = MessageType.Telegram });

        courierMessageService
            .Setup(x => x.CreateTelegramMessage(It.IsAny<OrderDataForMessageResponse>()))
            .Returns(new TelegramMessage { ChatId = 2, Text = "courier", Type = MessageType.Telegram });

        telegramService
            .Setup(x => x.SendAsync(It.IsAny<MessageBase>(), cancellationToken))
            .Returns(Task.CompletedTask);

        MessageService service = new(
            courierMessageService.Object,
            customerMessageService.Object,
            telegramService.Object,
            pharmacyMessageService.Object,
            new Mock<IOrderRepository>().Object,
            new TestOptionsMonitor<OsonSmsConfig>(new OsonSmsConfig { OsonSmsUrl = "https://oson.test" }));

        bool result = await service.SendAsync(TestDataFactory.CreateDbOrderForMessage(), smsMailing: false, cancellationToken);

        Assert.True(result);
        customerMessageService.Verify(x => x.CreateTelegramMessage(It.IsAny<OrderDataForMessageResponse>()), Times.Once);
        courierMessageService.Verify(x => x.CreateTelegramMessage(It.IsAny<OrderDataForMessageResponse>()), Times.Once);
        telegramService.Verify(x => x.SendAsync(It.IsAny<MessageBase>(), cancellationToken), Times.Exactly(2));
        pharmacyMessageService.VerifyNoOtherCalls();
    }
}
