using System.Globalization;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public sealed class ClientTelegramNotificationMessageService : IClientTelegramNotificationMessageService
{
  private readonly TelegramAuthOptions _options;

  public ClientTelegramNotificationMessageService(IOptions<TelegramAuthOptions> options)
  {
    ArgumentNullException.ThrowIfNull(options);
    _options = options.Value;
  }

  public string BuildOrderMessage(Guid orderId, Status status, decimal totalAmount, string? currency)
  {
    var statusText = status switch
    {
      Status.New => "Новый заказ создан и ожидает подтверждения.",
      Status.UnderReview => "Заказ подтвержден и передан аптеке.",
      Status.Preparing => "Аптека собирает заказ.",
      Status.Ready => "Заказ готов к выдаче или доставке.",
      Status.OnTheWay => "Заказ уже в пути.",
      Status.DriverArrived => "Курьер прибыл по адресу доставки.",
      Status.Delivered => "Заказ доставлен.",
      Status.PickedUp => "Заказ получен в аптеке.",
      Status.Cancelled => "Заказ отменен.",
      Status.Returned => "По заказу оформлен возврат.",
      _ => "Статус заказа обновлен."
    };

    var amount = totalAmount > 0
      ? $"\nСумма: {totalAmount.ToString("0.##", CultureInfo.InvariantCulture)} {NormalizeCurrency(currency)}"
      : string.Empty;

    return string.Join('\n',
      "Yalla Pharm",
      statusText,
      $"Заказ: #{ShortId(orderId)}{amount}",
      $"Открыть заказ: {BuildClientUrl($"/orders?orderId={orderId:D}")}");
  }

  public string BuildPrescriptionMessage(Guid prescriptionId, PrescriptionStatus status)
  {
    var statusText = status switch
    {
      PrescriptionStatus.Submitted => "Запрос на расшифровку рецепта создан.",
      PrescriptionStatus.AwaitingConfirmation => "Оплата запроса получена и ожидает подтверждения.",
      PrescriptionStatus.InQueue => "Запрос подтвержден и ожидает фармацевта.",
      PrescriptionStatus.InReview => "Фармацевт взял рецепт в работу.",
      PrescriptionStatus.Decoded => "Рецепт расшифрован. Проверьте список лекарств.",
      PrescriptionStatus.OrderPlaced => "По рецепту оформлен заказ.",
      PrescriptionStatus.MovedToCart => "Позиции из рецепта перенесены в корзину.",
      PrescriptionStatus.Cancelled => "Запрос на рецепт отменен.",
      PrescriptionStatus.DecodeFailed => "Рецепт не удалось расшифровать. Откройте запрос для деталей.",
      _ => "Статус запроса на рецепт обновлен."
    };

    return string.Join('\n',
      "Yalla Pharm",
      statusText,
      $"Запрос: #{ShortId(prescriptionId)}",
      $"Открыть запрос: {BuildClientUrl($"/prescriptions/{prescriptionId:D}")}");
  }

  private string BuildClientUrl(string path)
  {
    var publicBaseUrl = (_options.WebhookPublicBaseUrl ?? string.Empty).Trim().TrimEnd('/');
    return string.IsNullOrWhiteSpace(publicBaseUrl) ? path : $"{publicBaseUrl}{path}";
  }

  private static string NormalizeCurrency(string? currency)
    => string.IsNullOrWhiteSpace(currency) ? "TJS" : currency.Trim().ToUpperInvariant();

  private static string ShortId(Guid id)
    => id.ToString("N", CultureInfo.InvariantCulture)[..8];
}
