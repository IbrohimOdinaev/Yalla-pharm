using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class RefundRequestService : IRefundRequestService
{
  private readonly IAppDbContext _dbContext;
  private readonly ILogger<RefundRequestService> _logger;

  public RefundRequestService(IAppDbContext dbContext)
    : this(dbContext, NullLogger<RefundRequestService>.Instance)
  {
  }

  public RefundRequestService(
    IAppDbContext dbContext,
    ILogger<RefundRequestService> logger)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(logger);

    _dbContext = dbContext;
    _logger = logger;
  }

  public async Task<GetRefundRequestsResponse> GetRefundRequestsAsync(
    GetRefundRequestsRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var page = NormalizePage(request.Page);
    var pageSize = NormalizePageSize(request.PageSize);

    var query = _dbContext.RefundRequests.AsNoTracking();

    if (request.Status.HasValue)
      query = query.Where(x => x.Status == request.Status.Value);

    var totalCount = await query.CountAsync(cancellationToken);
    var refundRequests = await query
      .OrderByDescending(x => x.CreatedAtUtc)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .Select(x => new RefundRequestResponse
      {
        RefundRequestId = x.Id,
        OrderId = x.OrderId,
        ClientId = x.ClientId,
        PharmacyId = x.PharmacyId,
        PaymentTransactionId = x.PaymentTransactionId,
        Amount = x.Amount,
        Currency = x.Currency,
        Reason = x.Reason,
        Status = x.Status,
        CreatedAtUtc = x.CreatedAtUtc,
        UpdatedAtUtc = x.UpdatedAtUtc
      })
      .ToListAsync(cancellationToken);

    return new GetRefundRequestsResponse
    {
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      RefundRequests = refundRequests
    };
  }

  public async Task<InitiateRefundBySuperAdminResponse> InitiateRefundBySuperAdminAsync(
    InitiateRefundBySuperAdminRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.RefundRequestId == Guid.Empty)
      throw new DomainArgumentException("RefundRequestId can't be empty.");

    await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    try
    {
      var superAdmin = await GetSuperAdminOrThrowAsync(request.SuperAdminId, asTracking: true, cancellationToken);

      var refundRequest = await _dbContext.RefundRequests
        .AsTracking()
        .FirstOrDefaultAsync(x => x.Id == request.RefundRequestId, cancellationToken)
        ?? throw new InvalidOperationException($"RefundRequest '{request.RefundRequestId}' was not found.");

      var oldStatus = refundRequest.Status;
      refundRequest.MarkInitiatedBySuperAdmin();

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      _logger.LogInformation(
        "RefundRequest {RefundRequestId} status transition by SuperAdmin {SuperAdminId}: {OldStatus} -> {NewStatus}.",
        refundRequest.Id,
        superAdmin.Id,
        oldStatus,
        refundRequest.Status);

      return new InitiateRefundBySuperAdminResponse
      {
        SuperAdminId = superAdmin.Id,
        RefundRequestId = refundRequest.Id,
        PreviousStatus = oldStatus,
        Status = refundRequest.Status,
        UpdatedAtUtc = refundRequest.UpdatedAtUtc
      };
    }
    catch (Exception)
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private async Task<User> GetSuperAdminOrThrowAsync(
    Guid superAdminId,
    bool asTracking,
    CancellationToken cancellationToken)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");

    IQueryable<User> query = _dbContext.Users;
    query = asTracking ? query.AsTracking() : query.AsNoTracking();

    var superAdmin = await query
      .FirstOrDefaultAsync(x => x.Id == superAdminId, cancellationToken)
      ?? throw new InvalidOperationException($"SuperAdmin '{superAdminId}' was not found.");

    if (superAdmin.Role != Role.SuperAdmin)
      throw new InvalidOperationException($"User '{superAdminId}' does not have SuperAdmin role.");

    return superAdmin;
  }

  private static int NormalizePage(int page)
  {
    if (page <= 0)
      throw new DomainArgumentException("Page must be greater than zero.");

    return page;
  }

  private static int NormalizePageSize(int pageSize)
  {
    if (pageSize <= 0)
      throw new DomainArgumentException("PageSize must be greater than zero.");

    return Math.Min(pageSize, 200);
  }
}
