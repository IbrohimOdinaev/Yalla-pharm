using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PharmacyWorkerService : IPharmacyWorkerService
{
    private readonly IAppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IRealtimeUpdatesPublisher _realtimeUpdatesPublisher;

    public PharmacyWorkerService(
      IAppDbContext dbContext,
      IPasswordHasher passwordHasher,
      IRealtimeUpdatesPublisher realtimeUpdatesPublisher)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(passwordHasher);
        ArgumentNullException.ThrowIfNull(realtimeUpdatesPublisher);

        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _realtimeUpdatesPublisher = realtimeUpdatesPublisher;
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

        var pharmacy = await _dbContext.GetTrackedPharmacyOrThrowAsync(
          request.PharmacyId,
          cancellationToken);

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

        var pharmacy = await _dbContext.GetTrackedPharmacyOrThrowAsync(
          request.PharmacyId,
          cancellationToken);

        if (pharmacy.IsActive)
            pharmacy.ChangeActivity();

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeletePharmacyResponse
        {
            DeletedPharmacyId = request.PharmacyId
        };
    }

    public async Task<GetActivePharmaciesResponse> GetActivePharmaciesAsync(
      CancellationToken cancellationToken = default)
    {
        var pharmacies = await _dbContext.Pharmacies
          .AsNoTracking()
          .Where(x => x.IsActive)
          .OrderBy(x => x.Title)
          .Select(x => x.ToResponse())
          .ToListAsync(cancellationToken);

        return new GetActivePharmaciesResponse
        {
            Pharmacies = pharmacies
        };
    }

    public async Task<GetPharmaciesResponse> GetPharmaciesAsync(
      GetPharmaciesRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

        var query = _dbContext.Pharmacies
          .AsNoTracking()
          .AsQueryable();

        var queryText = request.Query?.Trim();
        if (!string.IsNullOrWhiteSpace(queryText))
        {
            var pattern = $"%{queryText}%";
            query = query.Where(x =>
              EF.Functions.Like(x.Title, pattern) ||
              EF.Functions.Like(x.Address, pattern));
        }

        if (request.IsActive.HasValue)
            query = query.Where(x => x.IsActive == request.IsActive.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var pharmacies = await query
          .OrderBy(x => x.Title)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .Select(x => x.ToResponse())
          .ToListAsync(cancellationToken);

        return new GetPharmaciesResponse
        {
            IsActive = request.IsActive,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Pharmacies = pharmacies
        };
    }

    public async Task<GetAdminsResponse> GetAdminsAsync(
      GetAdminsRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

        var query = _dbContext.PharmacyWorkers
          .AsNoTracking()
          .Include(x => x.Pharmacy)
          .AsQueryable();

        var queryText = request.Query?.Trim();
        if (!string.IsNullOrWhiteSpace(queryText))
        {
            var pattern = $"%{queryText}%";
            query = query.Where(x =>
              EF.Functions.Like(x.Name, pattern) ||
              EF.Functions.Like(x.PhoneNumber, pattern) ||
              (x.Pharmacy != null && EF.Functions.Like(x.Pharmacy.Title, pattern)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var admins = await query
          .OrderBy(x => x.Name)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .ToListAsync(cancellationToken);

        return new GetAdminsResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Admins = admins
              .Select(x => new AdminListItemResponse
              {
                  AdminId = x.Id,
                  Name = x.Name,
                  PhoneNumber = x.PhoneNumber,
                  PharmacyId = x.PharmacyId,
                  PharmacyTitle = x.Pharmacy?.Title ?? string.Empty,
                  PharmacyIsActive = x.Pharmacy?.IsActive ?? false
              })
              .ToList()
        };
    }

    public async Task<RegisterPharmacyWorkerResponse> RegisterPharmacyWorkerAsync(
      RegisterPharmacyWorkerRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

        var pharmacy = await _dbContext.Pharmacies
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        UserInputPolicy.EnsureValidPassword(request.Password, nameof(request.Password));
        var passwordHash = _passwordHasher.HashPassword(request.Password);
        if (!_passwordHasher.VerifyPassword(request.Password, passwordHash))
            throw new InvalidOperationException("Password hashing verification failed.");

        var worker = request.ToDomain(pharmacy, normalizedPhoneNumber, passwordHash);

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

        return await DeletePharmacyWorkerInternalAsync(
          request,
          expectedPharmacyId: null,
          cancellationToken);
    }

    public async Task<RegisterAdminWithPharmacyResponse> RegisterAdminWithPharmacyAsync(
      RegisterAdminWithPharmacyRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.AdminPhoneNumber);

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        UserInputPolicy.EnsureValidPassword(request.AdminPassword, nameof(request.AdminPassword));
        var passwordHash = _passwordHasher.HashPassword(request.AdminPassword);
        if (!_passwordHasher.VerifyPassword(request.AdminPassword, passwordHash))
            throw new InvalidOperationException("Password hashing verification failed.");

        var adminId = Guid.NewGuid();
        var pharmacyId = Guid.NewGuid();

        var pharmacy = new Pharmacy(
          pharmacyId,
          request.PharmacyTitle.Trim(),
          request.PharmacyAddress.Trim(),
          adminId,
          request.IsPharmacyActive);

        var worker = new PharmacyWorker(
          adminId,
          request.AdminName.Trim(),
          normalizedPhoneNumber,
          passwordHash,
          pharmacyId,
          pharmacy,
          Role.Admin);

        _dbContext.Pharmacies.Add(pharmacy);
        _dbContext.PharmacyWorkers.Add(worker);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterAdminWithPharmacyResponse
        {
            Pharmacy = pharmacy.ToResponse(),
            PharmacyWorker = worker.ToResponse()
        };
    }

    public async Task<UpsertOfferResponse> UpsertOfferAsync(
      UpsertOfferRequest request,
      Guid pharmacyId,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (pharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        if (request.MedicineId == Guid.Empty)
            throw new DomainArgumentException("MedicineId can't be empty.");

        if (request.StockQuantity < 0)
            throw new DomainArgumentException("StockQuantity can't be negative.");

        if (request.Price < 0)
            throw new DomainArgumentException("Price can't be negative.");

        var pharmacyExists = await _dbContext.Pharmacies
          .AnyAsync(x => x.Id == pharmacyId, cancellationToken);

        if (!pharmacyExists)
            throw new InvalidOperationException($"Pharmacy with id '{pharmacyId}' was not found.");

        var medicineExists = await _dbContext.Medicines
          .AnyAsync(x => x.Id == request.MedicineId, cancellationToken);

        if (!medicineExists)
            throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        var offer = await _dbContext.Offers
          .AsTracking()
          .FirstOrDefaultAsync(
            x => x.MedicineId == request.MedicineId && x.PharmacyId == pharmacyId,
            cancellationToken);

        var created = false;
        if (offer is null)
        {
            offer = new Offer(
              request.MedicineId,
              pharmacyId,
              request.StockQuantity,
              request.Price);

            _dbContext.Offers.Add(offer);
            created = true;
        }
        else
        {
            offer.SetStockQuantity(request.StockQuantity);
            offer.SetPrice(request.Price);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _realtimeUpdatesPublisher.PublishOfferUpdatedAsync(
          request.MedicineId, pharmacyId, request.Price, request.StockQuantity, cancellationToken);

        return new UpsertOfferResponse
        {
            OfferId = offer.Id,
            MedicineId = offer.MedicineId,
            PharmacyId = offer.PharmacyId,
            StockQuantity = offer.StockQuantity,
            Price = offer.Price,
            Created = created
        };
    }

    public async Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerInPharmacyAsync(
      DeletePharmacyWorkerRequest request,
      Guid pharmacyId,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (pharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        return await DeletePharmacyWorkerInternalAsync(
          request,
          expectedPharmacyId: pharmacyId,
          cancellationToken);
    }

    private async Task<DeletePharmacyWorkerResponse> DeletePharmacyWorkerInternalAsync(
      DeletePharmacyWorkerRequest request,
      Guid? expectedPharmacyId,
      CancellationToken cancellationToken)
    {
        var pharmacyWorker = await _dbContext.PharmacyWorkers
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyWorkerId, cancellationToken)
          ?? throw new InvalidOperationException(
            $"PharmacyWorker with id '{request.PharmacyWorkerId}' was not found.");

        if (expectedPharmacyId.HasValue && pharmacyWorker.PharmacyId != expectedPharmacyId.Value)
            throw new InvalidOperationException(
              $"PharmacyWorker '{request.PharmacyWorkerId}' does not belong to pharmacy '{expectedPharmacyId.Value}'.");

        _dbContext.PharmacyWorkers.Remove(pharmacyWorker);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeletePharmacyWorkerResponse
        {
            DeletedPharmacyWorkerId = request.PharmacyWorkerId
        };
    }
}
