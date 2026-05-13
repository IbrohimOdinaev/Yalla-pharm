using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PharmacistService : IPharmacistService
{
    private readonly IAppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditLogger? _auditLogger;

    public PharmacistService(
      IAppDbContext dbContext,
      IPasswordHasher passwordHasher,
      IAuditLogger? auditLogger = null)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _auditLogger = auditLogger;
    }

    public async Task<RegisterPharmacistResponse> RegisterAsync(
      RegisterPharmacistRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new InvalidOperationException("Pharmacist name is required.");

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);
        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        UserInputPolicy.EnsureValidPassword(request.Password, nameof(request.Password));
        var passwordHash = _passwordHasher.HashPassword(request.Password);
        if (!_passwordHasher.VerifyPassword(request.Password, passwordHash))
            throw new InvalidOperationException("Password hashing verification failed.");

        var pharmacist = new Pharmacist(request.Name.Trim(), normalizedPhoneNumber, passwordHash);
        _dbContext.Pharmacists.Add(pharmacist);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterPharmacistResponse { PharmacistId = pharmacist.Id };
    }

    public async Task<IReadOnlyList<PharmacistResponse>> GetAllAsync(
      CancellationToken cancellationToken = default)
    {
        return await _dbContext.Pharmacists
          .AsNoTracking()
          .OrderBy(x => x.Name)
          .Select(x => new PharmacistResponse
          {
              Id = x.Id,
              Name = x.Name,
              PhoneNumber = x.PhoneNumber
          })
          .ToListAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid pharmacistId, CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new InvalidOperationException("PharmacistId can't be empty.");

        var pharmacist = await _dbContext.Pharmacists
          .FirstOrDefaultAsync(x => x.Id == pharmacistId, cancellationToken)
          ?? throw new InvalidOperationException("Pharmacist not found.");

        // Refuse deletion if the pharmacist still has any in-flight reviews
        // — losing the assignee mid-review would orphan the prescription.
        var hasOpenReview = await _dbContext.Prescriptions
          .AnyAsync(p => p.AssignedPharmacistId == pharmacistId
                      && (p.Status == Yalla.Domain.Enums.PrescriptionStatus.InReview),
                    cancellationToken);
        if (hasOpenReview)
            throw new InvalidOperationException(
              "Pharmacist has prescriptions in review — finish or cancel them first.");

        _dbContext.Users.Remove(pharmacist);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<DeactivateUserResponse> DeactivateAsync(
      Guid pharmacistId,
      Guid superAdminId,
      DeactivateUserRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");
        if (superAdminId == Guid.Empty)
            throw new DomainArgumentException("SuperAdminId can't be empty.");

        var pharmacist = await _dbContext.Pharmacists
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == pharmacistId, cancellationToken)
          ?? throw new InvalidOperationException(
            $"Pharmacist '{pharmacistId}' was not found.");

        if (!pharmacist.IsActive)
            throw new ConflictException(
              $"Pharmacist '{pharmacistId}' is already inactive.");

        var openReviewsCount = await _dbContext.Prescriptions
          .AsNoTracking()
          .CountAsync(p => p.AssignedPharmacistId == pharmacistId
                        && p.Status == PrescriptionStatus.InReview,
                      cancellationToken);

        pharmacist.Deactivate(superAdminId, request.Reason, DateTime.UtcNow);

        if (_auditLogger is not null)
        {
            await _auditLogger.LogAsync(
              AuditAction.Deleted,
              entityType: "Pharmacist",
              entityId: pharmacist.Id,
              summary: $"Pharmacist {pharmacist.Id} deactivated by SuperAdmin {superAdminId}.",
              payload: new
              {
                  superAdminId,
                  reason = request.Reason,
                  openReviewsCountAtDeactivation = openReviewsCount,
              },
              cancellationToken: cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeactivateUserResponse
        {
            UserId = pharmacist.Id,
            IsActive = false,
            OpenWorkItemsCount = openReviewsCount,
            Warning = openReviewsCount > 0
              ? $"У фармацевта {openReviewsCount} активных расшифровок — назначьте их другому фармацевту."
              : null,
        };
    }

    public async Task<DeactivateUserResponse> ActivateAsync(
      Guid pharmacistId,
      Guid superAdminId,
      CancellationToken cancellationToken = default)
    {
        if (pharmacistId == Guid.Empty)
            throw new DomainArgumentException("PharmacistId can't be empty.");
        if (superAdminId == Guid.Empty)
            throw new DomainArgumentException("SuperAdminId can't be empty.");

        var pharmacist = await _dbContext.Pharmacists
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == pharmacistId, cancellationToken)
          ?? throw new InvalidOperationException(
            $"Pharmacist '{pharmacistId}' was not found.");

        if (pharmacist.IsActive)
            throw new ConflictException(
              $"Pharmacist '{pharmacistId}' is already active.");

        pharmacist.Activate(superAdminId);

        if (_auditLogger is not null)
        {
            await _auditLogger.LogAsync(
              AuditAction.Created,
              entityType: "Pharmacist",
              entityId: pharmacist.Id,
              summary: $"Pharmacist {pharmacist.Id} reactivated by SuperAdmin {superAdminId}.",
              payload: new { superAdminId },
              cancellationToken: cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeactivateUserResponse
        {
            UserId = pharmacist.Id,
            IsActive = true,
            OpenWorkItemsCount = 0,
        };
    }
}
