using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class PharmacistService : IPharmacistService
{
    private readonly IAppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;

    public PharmacistService(IAppDbContext dbContext, IPasswordHasher passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
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
}
