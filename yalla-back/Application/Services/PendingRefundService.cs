using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PendingRefundService : IPendingRefundService
{
  private readonly IAppDbContext _db;
  private readonly IAuditLogger? _auditLogger;

  public PendingRefundService(IAppDbContext db, IAuditLogger? auditLogger = null)
  {
    ArgumentNullException.ThrowIfNull(db);
    _db = db;
    _auditLogger = auditLogger;
  }

  public async Task<IReadOnlyList<PendingRefundResponse>> GetPendingAsync(
    CancellationToken cancellationToken = default)
  {
    return await _db.PendingRefunds
      .AsNoTracking()
      .Where(x => x.ProcessedAtUtc == null)
      .OrderBy(x => x.CreatedAtUtc)
      .Select(x => new PendingRefundResponse
      {
        Id = x.Id,
        ClientId = x.ClientId,
        PrescriptionId = x.PrescriptionId,
        Amount = x.Amount,
        Currency = x.Currency,
        Reason = x.Reason,
        CreatedAtUtc = x.CreatedAtUtc,
        ProcessedAtUtc = x.ProcessedAtUtc,
        ProcessedByUserId = x.ProcessedByUserId,
        SuperAdminComment = x.SuperAdminComment,
      })
      .ToListAsync(cancellationToken);
  }

  public async Task<PendingRefundResponse> MarkProcessedAsync(
    Guid refundId,
    Guid superAdminId,
    string? comment,
    CancellationToken cancellationToken = default)
  {
    if (refundId == Guid.Empty)
      throw new DomainArgumentException("RefundId can't be empty.");
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");

    var refund = await _db.PendingRefunds
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == refundId, cancellationToken)
      ?? throw new ClientErrorException(
        errorCode: "pending_refund_not_found",
        detail: "Возврат не найден.",
        reason: "not_found",
        statusCode: 404);

    refund.MarkProcessed(superAdminId, comment);

    if (_auditLogger is not null)
    {
      await _auditLogger.LogAsync(
        AuditAction.PaymentRefunded,
        entityType: "PendingRefund",
        entityId: refund.Id,
        summary: $"SuperAdmin {superAdminId} marked refund {refund.Id} ({refund.Amount} {refund.Currency}) as processed.",
        payload: new
        {
          superAdminId,
          clientId = refund.ClientId,
          prescriptionId = refund.PrescriptionId,
          amount = refund.Amount,
          comment,
        },
        cancellationToken: cancellationToken);
    }

    await _db.SaveChangesAsync(cancellationToken);

    return new PendingRefundResponse
    {
      Id = refund.Id,
      ClientId = refund.ClientId,
      PrescriptionId = refund.PrescriptionId,
      Amount = refund.Amount,
      Currency = refund.Currency,
      Reason = refund.Reason,
      CreatedAtUtc = refund.CreatedAtUtc,
      ProcessedAtUtc = refund.ProcessedAtUtc,
      ProcessedByUserId = refund.ProcessedByUserId,
      SuperAdminComment = refund.SuperAdminComment,
    };
  }
}
