using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class ClientAddressService : IClientAddressService
{
  private const int MaxHistorySize = 3;

  private readonly IAppDbContext _dbContext;

  public ClientAddressService(IAppDbContext dbContext)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    _dbContext = dbContext;
  }

  public async Task<IReadOnlyCollection<ClientAddressResponse>> GetAllAsync(
    Guid clientId,
    CancellationToken cancellationToken = default)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("clientId can't be empty.");

    var list = await _dbContext.ClientAddresses
      .AsNoTracking()
      .Where(x => x.ClientId == clientId)
      .OrderByDescending(x => x.LastUsedAtUtc)
      .ToListAsync(cancellationToken);

    return list.Select(ToResponse).ToList();
  }

  public async Task<ClientAddressResponse> UpsertAsync(
    Guid clientId,
    UpsertClientAddressRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("clientId can't be empty.");

    var trimmed = (request.Address ?? string.Empty).Trim();
    if (trimmed.Length == 0)
      throw new DomainArgumentException("Address can't be null or whitespace.");

    var existing = await FindByAddressAsync(clientId, trimmed, cancellationToken);
    if (existing is not null)
    {
      existing.SetCoordinates(request.Latitude, request.Longitude);
      if (!string.IsNullOrWhiteSpace(request.Title))
      {
        await EnsureTitleIsAvailableAsync(clientId, request.Title!, existing.Id, cancellationToken);
        existing.SetTitle(request.Title);
      }
      existing.TouchLastUsed();
      await _dbContext.SaveChangesAsync(cancellationToken);
      return ToResponse(existing);
    }

    if (!string.IsNullOrWhiteSpace(request.Title))
      await EnsureTitleIsAvailableAsync(clientId, request.Title!, null, cancellationToken);

    var entity = new ClientAddress(clientId, trimmed, request.Latitude, request.Longitude, request.Title);
    _dbContext.ClientAddresses.Add(entity);

    // Cap unnamed history at MaxHistorySize
    if (string.IsNullOrWhiteSpace(request.Title))
      await PruneHistoryAsync(clientId, cancellationToken);

    await _dbContext.SaveChangesAsync(cancellationToken);
    return ToResponse(entity);
  }

  public async Task<ClientAddressResponse> UpdateAsync(
    Guid clientId,
    Guid addressId,
    UpdateClientAddressRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var entity = await _dbContext.ClientAddresses
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == addressId && x.ClientId == clientId, cancellationToken)
      ?? throw new DomainArgumentException("Address not found.");

    if (request.ClearTitle)
    {
      entity.SetTitle(null);
    }
    else if (!string.IsNullOrWhiteSpace(request.Title))
    {
      await EnsureTitleIsAvailableAsync(clientId, request.Title!, addressId, cancellationToken);
      entity.SetTitle(request.Title);
    }

    if (!string.IsNullOrWhiteSpace(request.Address))
      entity.SetAddress(request.Address!);
    if (request.Latitude.HasValue && request.Longitude.HasValue)
      entity.SetCoordinates(request.Latitude.Value, request.Longitude.Value);

    await _dbContext.SaveChangesAsync(cancellationToken);
    return ToResponse(entity);
  }

  public async Task DeleteAsync(
    Guid clientId,
    Guid addressId,
    CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.ClientAddresses
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == addressId && x.ClientId == clientId, cancellationToken);

    if (entity is null) return;

    _dbContext.ClientAddresses.Remove(entity);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task RecordUsageAsync(
    Guid clientId,
    string address,
    double latitude,
    double longitude,
    CancellationToken cancellationToken = default)
  {
    if (clientId == Guid.Empty) return;
    var trimmed = (address ?? string.Empty).Trim();
    if (trimmed.Length == 0) return;

    var existing = await FindByAddressAsync(clientId, trimmed, cancellationToken);
    if (existing is not null)
    {
      existing.TouchLastUsed();
      existing.SetCoordinates(latitude, longitude);
    }
    else
    {
      var entity = new ClientAddress(clientId, trimmed, latitude, longitude);
      _dbContext.ClientAddresses.Add(entity);
      await PruneHistoryAsync(clientId, cancellationToken);
    }

    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task<ClientAddress?> FindByAddressAsync(Guid clientId, string address, CancellationToken cancellationToken)
  {
    var lowered = address.ToLower();
    return await _dbContext.ClientAddresses
      .AsTracking()
      .FirstOrDefaultAsync(
        x => x.ClientId == clientId && x.Address.ToLower() == lowered,
        cancellationToken);
  }

  private async Task EnsureTitleIsAvailableAsync(Guid clientId, string title, Guid? excludeId, CancellationToken cancellationToken)
  {
    var trimmed = title.Trim();
    var exists = await _dbContext.ClientAddresses
      .AsNoTracking()
      .AnyAsync(
        x => x.ClientId == clientId && x.Title == trimmed && (excludeId == null || x.Id != excludeId),
        cancellationToken);

    if (exists)
      throw new ClientErrorException(
        errorCode: "address_title_taken",
        detail: $"У вас уже есть адрес с именем «{trimmed}».",
        reason: "title_taken");
  }

  private async Task PruneHistoryAsync(Guid clientId, CancellationToken cancellationToken)
  {
    var unnamed = await _dbContext.ClientAddresses
      .AsTracking()
      .Where(x => x.ClientId == clientId && x.Title == null)
      .OrderByDescending(x => x.LastUsedAtUtc)
      .ToListAsync(cancellationToken);

    if (unnamed.Count >= MaxHistorySize)
    {
      foreach (var stale in unnamed.Skip(MaxHistorySize - 1))
        _dbContext.ClientAddresses.Remove(stale);
    }
  }

  private static ClientAddressResponse ToResponse(ClientAddress e) => new()
  {
    Id = e.Id,
    Address = e.Address,
    Title = e.Title,
    Latitude = e.Latitude,
    Longitude = e.Longitude,
    LastUsedAtUtc = e.LastUsedAtUtc,
    CreatedAtUtc = e.CreatedAtUtc
  };
}
