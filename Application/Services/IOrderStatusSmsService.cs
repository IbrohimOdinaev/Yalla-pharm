using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public interface IOrderStatusSmsService
{
  string? BuildMessage(Guid orderId, Status status);
  string? BuildPaymentConfirmedMessage(Guid orderId, decimal amount, string currency);
}
