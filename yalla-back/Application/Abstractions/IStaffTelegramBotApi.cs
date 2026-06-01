namespace Yalla.Application.Abstractions;

public interface IStaffTelegramBotApi
{
  Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default);
}
