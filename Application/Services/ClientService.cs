using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Abstractions;
using Yalla.Application.Extensions;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class ClientService : IClientService
{
    private readonly IAppDbContext _dbContext;

    public ClientService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RegisterClientResponse> RegisterClientAsync(
      RegisterClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = NormalizePhoneNumber(request.PhoneNumber);

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        var client = request.ToDomain(normalizedPhoneNumber);

        _dbContext.Clients.Add(client);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterClientResponse
        {
            Client = client.ToResponse([])
        };
    }

    public async Task<UpdateClientResponse> UpdateClientAsync(
      UpdateClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = NormalizePhoneNumber(request.PhoneNumber);

        var client = await _dbContext.Clients
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber && x.Id != request.ClientId, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        request.ApplyToDomain(client, normalizedPhoneNumber);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var basketByClient = await LoadBasketByClientIdsAsync([client.Id], cancellationToken);
        basketByClient.TryGetValue(client.Id, out var basketPositions);

        return new UpdateClientResponse
        {
            Client = client.ToResponse(basketPositions ?? [])
        };
    }

    public async Task<DeleteClientResponse> DeleteClientAsync(
      DeleteClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.Orders)
          .Include(x => x.BasketPositions)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        if (client.Orders.Count > 0)
            throw new InvalidOperationException(
              $"Client '{request.ClientId}' has orders and cannot be deleted.");

        if (client.BasketPositions.Count > 0)
        {
            var basketPositions = client.BasketPositions.ToList();

            foreach (var basketPosition in basketPositions)
                client.RemovePosition(basketPosition);

            _dbContext.Positions.RemoveRange(basketPositions);
        }

        _dbContext.Clients.Remove(client);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeleteClientResponse
        {
            DeletedClientId = request.ClientId
        };
    }

    public async Task<AddProductToBasketResponse> AddProductToBasketAsync(
      AddProductToBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Quantity <= 0)
            throw new DomainArgumentException("Quantity must be greater than zero.");

        var client = await _dbContext.Clients
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        if (!medicine.IsActive)
            throw new InvalidOperationException(
              $"Medicine '{request.MedicineId}' is inactive and cannot be added to basket.");

        var pharmacy = await _dbContext.Pharmacies
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        if (!pharmacy.IsActive)
            throw new InvalidOperationException(
              $"Pharmacy '{request.PharmacyId}' is inactive and cannot be used for basket.");

        var liveOffer = await _dbContext.PharmacyOffers
          .AsTracking()
          .FirstOrDefaultAsync(
            x => x.MedicineId == request.MedicineId && x.PharmacyId == request.PharmacyId,
            cancellationToken)
          ?? throw new InvalidOperationException(
            $"Offer for medicine '{request.MedicineId}' in pharmacy '{request.PharmacyId}' was not found.");

        var existingPosition = await _dbContext.Positions
          .FirstOrDefaultAsync(
              x => x.OrderId == null
              && x.MedicineId == request.MedicineId
              && x.CapturedOffer.PharmacyId == request.PharmacyId
              && EF.Property<Guid?>(x, "basket_client_id") == request.ClientId,
            cancellationToken);

        if (existingPosition is not null)
        {
            existingPosition.SetQuantity(
              existingPosition.Quantity + request.Quantity,
              liveOffer);
            existingPosition.RefreshCapturedOffer(liveOffer);

            await _dbContext.SaveChangesAsync(cancellationToken);

            return new AddProductToBasketResponse
            {
                ClientId = request.ClientId,
                BasketPosition = existingPosition.ToResponse(liveOffer.Price),
                BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
            };
        }

        var newPosition = request.ToDomain(medicine, liveOffer);
        client.AddPosition(newPosition);

        _dbContext.Positions.Add(newPosition);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AddProductToBasketResponse
        {
            ClientId = request.ClientId,
            BasketPosition = newPosition.ToResponse(liveOffer.Price),
            BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
        };
    }

    public async Task<RemoveProductFromBasketResponse> RemoveProductFromBasketAsync(
      RemoveProductFromBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .Include(x => x.BasketPositions)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var positionToRemove = client.BasketPositions
          .FirstOrDefault(x => x.Id == request.PositionId);

        if (positionToRemove is null)
            throw new InvalidOperationException(
              $"Position '{request.PositionId}' was not found in client '{request.ClientId}' basket.");

        client.RemovePosition(positionToRemove);
        _dbContext.Positions.Remove(positionToRemove);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RemoveProductFromBasketResponse
        {
            ClientId = request.ClientId,
            RemovedPositionId = request.PositionId,
            BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
        };
    }

    public async Task<GetAllClientsResponse> GetAllClientsAsync(
      GetAllClientsRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

        var totalCount = await _dbContext.Clients.CountAsync(cancellationToken);

        var clients = await _dbContext.Clients
          .AsNoTracking()
          .OrderBy(x => x.Name)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .ToListAsync(cancellationToken);

        var clientIds = clients.Select(x => x.Id).ToList();
        var basketByClient = await LoadBasketByClientIdsAsync(clientIds, cancellationToken);

        var responseItems = clients
          .Select(x =>
          {
              basketByClient.TryGetValue(x.Id, out var basketPositions);
              return x.ToResponse(basketPositions ?? []);
          })
          .ToList();

        return new GetAllClientsResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Clients = responseItems
        };
    }

    public async Task<GetClientByPhoneNumberResponse> GetClientByPhoneNumberAsync(
      GetClientByPhoneNumberRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = NormalizePhoneNumber(request.PhoneNumber);

        var client = await _dbContext.Clients
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken)
          ?? throw new InvalidOperationException(
            $"Client with phone number '{normalizedPhoneNumber}' was not found.");

        var basketByClient = await LoadBasketByClientIdsAsync([client.Id], cancellationToken);
        basketByClient.TryGetValue(client.Id, out var basketPositions);

        return new GetClientByPhoneNumberResponse
        {
            Client = client.ToResponse(basketPositions ?? [])
        };
    }

    public async Task<CheckoutBasketResponse> CheckoutBasketAsync(
      CheckoutBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.DeliveryAddress))
            throw new DomainArgumentException("DeliveryAddress can't be null or whitespace.");

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .ThenInclude(x => x.Medicine)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPositions = client.BasketPositions.ToList();

        if (basketPositions.Count == 0)
            throw new InvalidOperationException($"Client '{request.ClientId}' basket is empty.");

        var medicineIds = basketPositions
          .Select(x => x.MedicineId)
          .Distinct()
          .ToList();

        var pharmacyIds = basketPositions
          .Select(x => x.CapturedOffer.PharmacyId)
          .Distinct()
          .ToList();

        var liveOffers = await _dbContext.PharmacyOffers
          .AsTracking()
          .Where(x => medicineIds.Contains(x.MedicineId) && pharmacyIds.Contains(x.PharmacyId))
          .ToListAsync(cancellationToken);

        var liveOffersByKey = liveOffers.ToDictionary(
          x => (x.MedicineId, x.PharmacyId),
          x => x);

        foreach (var basketPosition in basketPositions)
        {
            var key = (basketPosition.MedicineId, basketPosition.CapturedOffer.PharmacyId);

            if (!liveOffersByKey.TryGetValue(key, out var liveOffer))
                throw new InvalidOperationException(
                  $"Offer for medicine '{basketPosition.MedicineId}' in pharmacy '{basketPosition.CapturedOffer.PharmacyId}' was not found.");

            if (basketPosition.Quantity > liveOffer.StockQuantity)
                throw new InvalidOperationException(
                  $"Quantity '{basketPosition.Quantity}' exceeds stock '{liveOffer.StockQuantity}' for medicine '{basketPosition.MedicineId}' in pharmacy '{liveOffer.PharmacyId}'.");

            basketPosition.RefreshCapturedOffer(liveOffer);
        }

        var order = request.ToDomain(basketPositions);

        foreach (var basketPosition in basketPositions)
        {
            basketPosition.AttachOrderId(order.Id);
            client.RemovePosition(basketPosition);
        }

        client.AddOrder(order);

        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return order.ToResponse();
    }

    private async Task<int> CountBasketItemsAsync(Guid clientId, CancellationToken cancellationToken)
    {
        return await _dbContext.Positions
          .CountAsync(
            x => x.OrderId == null
              && EF.Property<Guid?>(x, "basket_client_id") == clientId,
            cancellationToken);
    }

    private async Task<Dictionary<Guid, List<BasketPositionResponse>>> LoadBasketByClientIdsAsync(
      IReadOnlyCollection<Guid> clientIds,
      CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
            return [];

        var basketRows = await _dbContext.Positions
          .AsNoTracking()
          .Where(x => x.OrderId == null)
          .Select(x => new
          {
              BasketClientId = EF.Property<Guid?>(x, "basket_client_id"),
              Position = x
          })
          .Where(x => x.BasketClientId.HasValue && clientIds.Contains(x.BasketClientId.Value))
          .GroupJoin(
            _dbContext.PharmacyOffers.AsNoTracking(),
            x => new
            {
                x.Position.MedicineId,
                PharmacyId = x.Position.CapturedOffer.PharmacyId
            },
            y => new
            {
                y.MedicineId,
                y.PharmacyId
            },
            (x, offers) => new
            {
                x.BasketClientId,
                x.Position,
                Offers = offers
            })
          .SelectMany(
            x => x.Offers.DefaultIfEmpty(),
            (x, liveOffer) => new
            {
                BasketClientId = x.BasketClientId!.Value,
                Position = x.Position,
                LivePrice = liveOffer == null ? (decimal?)null : liveOffer.Price
            })
          .ToListAsync(cancellationToken);

        return basketRows
          .GroupBy(x => x.BasketClientId)
          .ToDictionary(
            x => x.Key,
            x => x
              .Select(y => y.Position.ToResponse(y.LivePrice ?? y.Position.CapturedOffer.Price))
              .ToList());
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
