using Yalla.Domain.Enums;

namespace Yalla.Application.Services;

public interface IClientTelegramNotificationMessageService
{
  string BuildOrderMessage(Guid orderId, Status status, decimal totalAmount, string? currency);

  string BuildPrescriptionMessage(Guid prescriptionId, PrescriptionStatus status);
}
