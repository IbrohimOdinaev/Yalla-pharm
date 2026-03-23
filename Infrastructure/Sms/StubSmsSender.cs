using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Sms;

public sealed class StubSmsSender : ISmsSender
{
  private readonly ILogger<StubSmsSender> _logger;

  public StubSmsSender(ILogger<StubSmsSender> logger)
  {
    _logger = logger;
  }

  public Task<SmsSendResult> SendSmsAsync(
    SmsSendCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    var messagePreview = command.Message.Length <= 128
      ? command.Message
      : $"{command.Message[..128]}...";

    _logger.LogInformation(
      "Stub SMS sender: phone={Phone}, txnId={TxnId}, message={Message}",
      command.PhoneNumber,
      command.TxnId,
      messagePreview);

    return Task.FromResult(new SmsSendResult
    {
      IsSuccess = true,
      StatusCode = 201,
      TxnId = command.TxnId,
      MsgId = $"stub-{Guid.NewGuid():N}"
    });
  }

  public Task<SmsDeliveryVerificationResult> VerifySmsAsync(
    SmsDeliveryVerificationCommand command,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(command);

    return Task.FromResult(new SmsDeliveryVerificationResult
    {
      IsSuccess = true,
      StatusCode = 200,
      DeliveryStatus = "DELIVERED"
    });
  }
}
