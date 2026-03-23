using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public sealed class OrderStatusSmsService : IOrderStatusSmsService
{
  private const string DefaultPaymentConfirmedTemplate =
    "Оплата подтверждена. Заказ {orderId} оформлен. Сумма: {amount} {currency}.";

  private static readonly IReadOnlyDictionary<Status, string> DefaultTemplates = new Dictionary<Status, string>
  {
    [Status.New] = "Заказ {orderId} создан и ожидает подтверждения.",
    [Status.UnderReview] = "Заказ {orderId} принят и передан в обработку.",
    [Status.Preparing] = "Заказ {orderId} готовится аптекой.",
    [Status.Ready] = "Заказ {orderId} собран и готов к выдаче/доставке.",
    [Status.OnTheWay] = "Заказ {orderId} передан курьеру и в пути.",
    [Status.Delivered] = "Заказ {orderId} успешно доставлен.",
    [Status.Cancelled] = "Заказ {orderId} отменен.",
    [Status.Returned] = "Заказ {orderId} переведен в статус возврата."
  };

  private readonly SmsTemplatesOptions _options;

  public OrderStatusSmsService(IOptions<SmsTemplatesOptions> options)
  {
    ArgumentNullException.ThrowIfNull(options);

    _options = options.Value;
  }

  public string? BuildMessage(Guid orderId, Status status)
  {
    var template = ResolveTemplate(status);
    if (string.IsNullOrWhiteSpace(template))
      return null;

    return template
      .Replace("{orderId}", orderId.ToString("D"), StringComparison.OrdinalIgnoreCase)
      .Replace("{status}", status.ToString(), StringComparison.OrdinalIgnoreCase);
  }

  public string? BuildPaymentConfirmedMessage(Guid orderId, decimal amount, string currency)
  {
    var template = string.IsNullOrWhiteSpace(_options.PaymentConfirmed)
      ? DefaultPaymentConfirmedTemplate
      : _options.PaymentConfirmed.Trim();

    if (string.IsNullOrWhiteSpace(template))
      return null;

    return template
      .Replace("{orderId}", orderId.ToString("D"), StringComparison.OrdinalIgnoreCase)
      .Replace("{amount}", amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase)
      .Replace("{currency}", (currency ?? string.Empty).Trim().ToUpperInvariant(), StringComparison.OrdinalIgnoreCase);
  }

  private string ResolveTemplate(Status status)
  {
    var key = status.ToString();
    if (_options.OrderStatus.TryGetValue(key, out var configuredTemplate)
      && !string.IsNullOrWhiteSpace(configuredTemplate))
    {
      return configuredTemplate.Trim();
    }

    return DefaultTemplates.TryGetValue(status, out var defaultTemplate)
      ? defaultTemplate
      : string.Empty;
  }
}
