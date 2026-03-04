using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PharmacyWorkerService : IPharmacyWorkerService
{
    private readonly IAppDbContext _dbContext;

    public PharmacyWorkerService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RegisterPharmacyResponse> RegisterPharmacyAsync(
      RegisterPharmacyRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var adminExists = await _dbContext.Users
          .AnyAsync(x => x.Id == request.AdminId, cancellationToken);

        if (!adminExists)
            throw new InvalidOperationException($"Admin user with id '{request.AdminId}' was not found.");

        var pharmacy = request.ToDomain();

        _dbContext.Pharmacies.Add(pharmacy);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterPharmacyResponse
        {
            Pharmacy = pharmacy.ToResponse()
        };
    }

    public async Task<UpdatePharmacyResponse> UpdatePharmacyAsync(
      UpdatePharmacyRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var pharmacy = await _dbContext.Pharmacies
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        var adminExists = await _dbContext.Users
          .AnyAsync(x => x.Id == request.AdminId, cancellationToken);

        if (!adminExists)
            throw new InvalidOperationException($"Admin user with id '{request.AdminId}' was not found.");

        request.ApplyToDomain(pharmacy);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UpdatePharmacyResponse
        {
            Pharmacy = pharmacy.ToResponse()
        };
    }

    public async Task<DeletePharmacyResponse> DeletePharmacyAsync(
      DeletePharmacyRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var pharmacy = await _dbContext.Pharmacies
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        var pharmacyWorkers = await _dbContext.PharmacyWorkers
          .Where(x => x.PharmacyId == request.PharmacyId)
          .ToListAsync(cancellationToken);

        if (pharmacyWorkers.Count > 0)
            _dbContext.PharmacyWorkers.RemoveRange(pharmacyWorkers);

        var pharmacyOrders = await _dbContext.PharmacyOrders
          .Where(x => x.PharmacyId == request.PharmacyId)
          .ToListAsync(cancellationToken);

        if (pharmacyOrders.Count > 0)
            _dbContext.PharmacyOrders.RemoveRange(pharmacyOrders);

        var pharmacyOffers = await _dbContext.PharmacyOffers
          .Where(x => x.PharmacyId == request.PharmacyId)
          .ToListAsync(cancellationToken);

        if (pharmacyOffers.Count > 0)
            _dbContext.PharmacyOffers.RemoveRange(pharmacyOffers);

        _dbContext.Pharmacies.Remove(pharmacy);

        var adminUser = await _dbContext.Users
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == pharmacy.AdminId, cancellationToken);

        if (adminUser is not null)
            _dbContext.Users.Remove(adminUser);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeletePharmacyResponse
        {
            DeletedPharmacyId = request.PharmacyId
        };
    }

    public async Task<RegisterPharmacyWorkerResponse> RegisterPharmacyWorkerAsync(
      RegisterPharmacyWorkerRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = NormalizePhoneNumber(request.PhoneNumber);

        var pharmacy = await _dbContext.Pharmacies
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        var worker = request.ToDomain(pharmacy, normalizedPhoneNumber);

        _dbContext.PharmacyWorkers.Add(worker);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterPharmacyWorkerResponse
        {
            PharmacyWorker = worker.ToResponse()
        };
    }

    public async Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerAsync(
      DeletePharmacyWorkerRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var pharmacyWorker = await _dbContext.PharmacyWorkers
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyWorkerId, cancellationToken)
          ?? throw new InvalidOperationException(
            $"PharmacyWorker with id '{request.PharmacyWorkerId}' was not found.");

        _dbContext.PharmacyWorkers.Remove(pharmacyWorker);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeletePharmacyWorkerResponse
        {
            DeletedPharmacyWorkerId = request.PharmacyWorkerId
        };
    }

    private static string NormalizePhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new DomainArgumentException("PhoneNumber can't be null or whitespace.");

        var normalizedPhone = phoneNumber.Trim();

        if (!normalizedPhone.All(char.IsDigit))
            throw new DomainArgumentException("PhoneNumber must contain digits only.");

        return normalizedPhone;
    }
}
