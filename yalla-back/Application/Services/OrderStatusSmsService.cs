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
    [Status.UnderReview] = "Ваш заказ с Id: {orderId} на сумму: {amount} {currency} подтверждён.",
    [Status.Preparing] = "Заказ с Id: {orderId} на сумму: {amount} {currency} собирается аптекой.",
    [Status.Ready] = "Заказ с Id: {orderId} на сумму: {amount} {currency} собран и готов к выдаче/доставке.",
    [Status.OnTheWay] = "Заказ с Id: {orderId} на сумму: {amount} {currency} уже едет к вам.",
    [Status.DriverArrived] = "Курьер прибыл по адресу. Заказ с Id: {orderId} на сумму: {amount} {currency}.",
    [Status.Delivered] = "Заказ с Id: {orderId} на сумму: {amount} {currency} успешно доставлен.",
    [Status.PickedUp] = "Заказ с Id: {orderId} на сумму: {amount} {currency} получен в аптеке.",
    [Status.Cancelled] = "Заказ с Id: {orderId} на сумму: {amount} {currency} отменён.",
    [Status.Returned] = "Заказ с Id: {orderId} на сумму: {amount} {currency} переведён в статус возврата.",
  };

  private readonly SmsTemplatesOptions _options;

  public OrderStatusSmsService(IOptions<SmsTemplatesOptions> options)
  {
    ArgumentNullException.ThrowIfNull(options);

    _options = options.Value;
  }

  public string? BuildMessage(Guid orderId, Status status, decimal cost = 0, string? currency = null)
  {
    var template = ResolveTemplate(status);
    if (string.IsNullOrWhiteSpace(template))
      return null;

    var cur = string.IsNullOrWhiteSpace(currency) ? "TJS" : currency.Trim().ToUpperInvariant();

    return template
      .Replace("{orderId}", orderId.ToString("D"), StringComparison.OrdinalIgnoreCase)
      .Replace("{status}", status.ToString(), StringComparison.OrdinalIgnoreCase)
      .Replace("{amount}", cost.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase)
      .Replace("{currency}", cur, StringComparison.OrdinalIgnoreCase);
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
