using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Domain.Entities;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class ClientService : IClientService
{
    private readonly IAppDbContext _dbContext;
    private readonly IPaymentService _paymentService;
    private readonly IPasswordHasher _passwordHasher;

    public ClientService(IAppDbContext dbContext)
      : this(dbContext, new StubPaymentService(), new BCryptPasswordHasher())
    {
    }

    public ClientService(
      IAppDbContext dbContext,
      IPaymentService paymentService)
      : this(dbContext, paymentService, new BCryptPasswordHasher())
    {
    }

    public ClientService(
      IAppDbContext dbContext,
      IPaymentService paymentService,
      IPasswordHasher passwordHasher)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(paymentService);
        ArgumentNullException.ThrowIfNull(passwordHasher);

        _dbContext = dbContext;
        _paymentService = paymentService;
        _passwordHasher = passwordHasher;
    }

    public async Task<RegisterClientResponse> RegisterClientAsync(
      RegisterClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

        UserInputPolicy.EnsureValidPassword(request.Password, nameof(request.Password));
        var passwordHash = _passwordHasher.HashPassword(request.Password);
        if (!_passwordHasher.VerifyPassword(request.Password, passwordHash))
            throw new InvalidOperationException("Password hashing verification failed.");

        var client = request.ToDomain(normalizedPhoneNumber, passwordHash);

        _dbContext.Clients.Add(client);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RegisterClientResponse
        {
            Client = client.ToResponse([], [])
        };
    }

    public async Task<UpdateClientResponse> UpdateClientAsync(
      UpdateClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

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

        var basketData = await LoadBasketByClientIdAsync(client.Id, cancellationToken);
        var orders = await LoadClientOrdersAsync(client.Id, cancellationToken);

        return new UpdateClientResponse
        {
            Client = client.ToResponse(basketData.Positions, orders, basketData.PharmacyOptions)
        };
    }

    public async Task<DeleteClientResponse> DeleteClientAsync(
      DeleteClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
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
                    client.RemoveBasketPosition(basketPosition);

                _dbContext.BasketPositions.RemoveRange(basketPositions);
            }

            _dbContext.Clients.Remove(client);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

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

        var client = await _dbContext.GetTrackedClientOrThrowAsync(request.ClientId, cancellationToken);

        var medicine = await _dbContext.GetTrackedMedicineOrThrowAsync(request.MedicineId, cancellationToken);

        if (!medicine.IsActive)
            throw new InvalidOperationException(
              $"Medicine '{request.MedicineId}' is inactive and cannot be added to basket.");

        var existingPosition = await _dbContext.BasketPositions
          .AsTracking()
          .FirstOrDefaultAsync(
            x => x.ClientId == request.ClientId
              && x.MedicineId == request.MedicineId,
            cancellationToken);

        if (existingPosition is not null)
        {
            existingPosition.SetQuantity(existingPosition.Quantity + request.Quantity);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var basketData = await LoadBasketByClientIdAsync(request.ClientId, cancellationToken);

            return new AddProductToBasketResponse
            {
                ClientId = request.ClientId,
                BasketPosition = existingPosition.ToResponse(),
                PharmacyOptions = basketData.PharmacyOptions,
                BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
            };
        }

        var newPosition = request.ToDomain(medicine);
        client.AddBasketPosition(newPosition);

        _dbContext.BasketPositions.Add(newPosition);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var newBasketData = await LoadBasketByClientIdAsync(request.ClientId, cancellationToken);

        return new AddProductToBasketResponse
        {
            ClientId = request.ClientId,
            BasketPosition = newPosition.ToResponse(),
            PharmacyOptions = newBasketData.PharmacyOptions,
            BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
        };
    }

    public async Task<RemoveProductFromBasketResponse> RemoveProductFromBasketAsync(
      RemoveProductFromBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPositionToRemove = client.BasketPositions
          .FirstOrDefault(x => x.Id == request.PositionId);

        if (basketPositionToRemove is null)
            throw new InvalidOperationException(
              $"Basket position '{request.PositionId}' was not found in client '{request.ClientId}' basket.");

        client.RemoveBasketPosition(basketPositionToRemove);
        _dbContext.BasketPositions.Remove(basketPositionToRemove);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new RemoveProductFromBasketResponse
        {
            ClientId = request.ClientId,
            RemovedPositionId = request.PositionId,
            BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
        };
    }

    public async Task<UpdateBasketPositionQuantityResponse> UpdateBasketPositionQuantityAsync(
      UpdateBasketPositionQuantityRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Quantity <= 0)
            throw new DomainArgumentException("Quantity must be greater than zero.");

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPosition = client.BasketPositions
          .FirstOrDefault(x => x.Id == request.PositionId);

        if (basketPosition is null)
            throw new InvalidOperationException(
              $"Basket position '{request.PositionId}' was not found in client '{request.ClientId}' basket.");

        basketPosition.SetQuantity(request.Quantity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var basketData = await LoadBasketByClientIdAsync(request.ClientId, cancellationToken);

        return new UpdateBasketPositionQuantityResponse
        {
            ClientId = request.ClientId,
            BasketPosition = basketPosition.ToResponse(),
            PharmacyOptions = basketData.PharmacyOptions,
            BasketItemsCount = await CountBasketItemsAsync(request.ClientId, cancellationToken)
        };
    }

    public async Task<ClearBasketResponse> ClearBasketAsync(
      ClearBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPositions = client.BasketPositions.ToList();
        if (basketPositions.Count > 0)
        {
            foreach (var basketPosition in basketPositions)
                client.RemoveBasketPosition(basketPosition);

            _dbContext.BasketPositions.RemoveRange(basketPositions);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return new ClearBasketResponse
        {
            ClientId = request.ClientId,
            RemovedPositionsCount = basketPositions.Count,
            BasketItemsCount = 0,
            PharmacyOptions = []
        };
    }

    public async Task<GetBasketResponse> GetBasketAsync(
      GetBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var clientExists = await _dbContext.Clients
          .AsNoTracking()
          .AnyAsync(x => x.Id == request.ClientId, cancellationToken);

        if (!clientExists)
            throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketData = await LoadBasketByClientIdAsync(request.ClientId, cancellationToken);

        return new GetBasketResponse
        {
            ClientId = request.ClientId,
            BasketItemsCount = basketData.Positions.Count,
            BasketPositions = basketData.Positions,
            PharmacyOptions = basketData.PharmacyOptions
        };
    }

    public async Task<GetAllClientsResponse> GetAllClientsAsync(
      GetAllClientsRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;
        var queryText = request.Query?.Trim();

        var clientsQuery = _dbContext.Clients
          .AsNoTracking()
          .AsQueryable();

        if (!string.IsNullOrWhiteSpace(queryText))
        {
            var pattern = $"%{queryText}%";
            clientsQuery = clientsQuery.Where(x =>
              EF.Functions.Like(x.Name, pattern) ||
              EF.Functions.Like(x.PhoneNumber, pattern));
        }

        var totalCount = await clientsQuery.CountAsync(cancellationToken);

        var clients = await clientsQuery
          .OrderBy(x => x.Name)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .ToListAsync(cancellationToken);

        var clientIds = clients.Select(x => x.Id).ToList();
        var basketByClient = await LoadBasicBasketPositionsByClientIdsAsync(clientIds, cancellationToken);
        var ordersByClient = await LoadClientOrdersByClientIdsAsync(clientIds, cancellationToken);

        var responseItems = clients
          .Select(client =>
          {
              basketByClient.TryGetValue(client.Id, out var basketPositions);
              ordersByClient.TryGetValue(client.Id, out var orders);

              return client.ToResponse(
                basketPositions ?? [],
                orders ?? []);
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

    public async Task<GetAllClientsResponse> GetAllClientsWithBasketAsync(
      GetAllClientsRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;
        var queryText = request.Query?.Trim();

        var clientsQuery = _dbContext.Clients
          .AsNoTracking()
          .AsQueryable();

        if (!string.IsNullOrWhiteSpace(queryText))
        {
            var pattern = $"%{queryText}%";
            clientsQuery = clientsQuery.Where(x =>
              EF.Functions.Like(x.Name, pattern) ||
              EF.Functions.Like(x.PhoneNumber, pattern));
        }

        var totalCount = await clientsQuery.CountAsync(cancellationToken);

        var clients = await clientsQuery
          .OrderBy(x => x.Name)
          .Skip((page - 1) * pageSize)
          .Take(pageSize)
          .ToListAsync(cancellationToken);

        var clientIds = clients.Select(x => x.Id).ToList();
        var ordersByClient = await LoadClientOrdersByClientIdsAsync(clientIds, cancellationToken);

        var responseItems = new List<ClientResponse>(clients.Count);
        foreach (var client in clients)
        {
            var basketData = await LoadBasketByClientIdAsync(client.Id, cancellationToken);
            ordersByClient.TryGetValue(client.Id, out var orders);

            responseItems.Add(
              client.ToResponse(
                basketData.Positions,
                orders ?? [],
                basketData.PharmacyOptions));
        }

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

        var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

        var client = await _dbContext.Clients
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken)
          ?? throw new InvalidOperationException(
            $"Client with phone number '{normalizedPhoneNumber}' was not found.");

        var basketData = await LoadBasketByClientIdAsync(client.Id, cancellationToken);
        var orders = await LoadClientOrdersAsync(client.Id, cancellationToken);

        return new GetClientByPhoneNumberResponse
        {
            Client = client.ToResponse(basketData.Positions, orders, basketData.PharmacyOptions)
        };
    }

    public async Task<GetClientByIdResponse> GetClientByIdAsync(
      GetClientByIdRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketData = await LoadBasketByClientIdAsync(client.Id, cancellationToken);
        var orders = await LoadClientOrdersAsync(client.Id, cancellationToken);

        return new GetClientByIdResponse
        {
            Client = client.ToResponse(basketData.Positions, orders, basketData.PharmacyOptions)
        };
    }

    public async Task<CheckoutBasketResponse> CheckoutBasketAsync(
      CheckoutBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.PharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .ThenInclude(x => x.Medicine)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPositions = client.BasketPositions.ToList();

        if (basketPositions.Count == 0)
            throw new InvalidOperationException($"Client '{request.ClientId}' basket is empty.");

        var pharmacy = await _dbContext.GetTrackedPharmacyOrThrowAsync(request.PharmacyId, cancellationToken);

        if (!pharmacy.IsActive)
            throw new InvalidOperationException(
              $"Pharmacy '{request.PharmacyId}' is inactive and cannot be used for checkout.");

        var effectiveDeliveryAddress = request.IsPickup
          ? (request.PharmacyId == pharmacy.Id ? pharmacy.Address : string.Empty)?.Trim() ?? string.Empty
          : request.DeliveryAddress?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(effectiveDeliveryAddress))
        {
            throw request.IsPickup
              ? new DomainArgumentException("Pickup order requires non-empty pharmacy address.")
              : new DomainArgumentException("DeliveryAddress can't be null or whitespace.");
        }

        var ignoredPositionIds = request.IgnoredPositionIds?.ToHashSet() ?? [];
        ValidateIgnoredPositionIds(basketPositions, ignoredPositionIds);

        var evaluation = await BuildCheckoutEvaluationAsync(
          basketPositions,
          request.PharmacyId,
          ignoredPositionIds,
          cancellationToken);

        if (!evaluation.CanCheckout)
        {
            var firstBlocking = evaluation.Positions
              .First(x => x.IsRejected && x.Reason != CheckoutRejectReason.IgnoredByClient);

            throw firstBlocking.Reason switch
            {
                CheckoutRejectReason.MedicineInactive => new InvalidOperationException(
                  $"Medicine '{firstBlocking.BasketPosition.MedicineId}' is inactive and cannot be checked out."),
                CheckoutRejectReason.OfferNotFound => new InvalidOperationException(
                  $"Medicine '{firstBlocking.BasketPosition.MedicineId}' is not available in pharmacy '{request.PharmacyId}'."),
                CheckoutRejectReason.InsufficientStock => new InvalidOperationException(
                  $"Quantity '{firstBlocking.BasketPosition.Quantity}' exceeds stock '{firstBlocking.FoundQuantity}' for medicine '{firstBlocking.BasketPosition.MedicineId}' in pharmacy '{request.PharmacyId}'."),
                _ => new InvalidOperationException("Checkout failed due to invalid basket state.")
            };
        }

        var acceptedPositions = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Select(x => x.BasketPosition)
          .ToList();

        if (acceptedPositions.Count == 0)
            throw new InvalidOperationException("At least one basket position must be selected for checkout.");

        var acceptedByMedicineId = acceptedPositions
          .GroupBy(x => x.MedicineId)
          .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

        var estimatedCost = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Sum(x => (x.Price ?? 0m) * x.BasketPosition.Quantity);

        if (estimatedCost <= 0m)
            throw new InvalidOperationException("Checkout total amount must be greater than zero.");

        var orderId = Guid.NewGuid();
        var paymentResponse = await _paymentService.PayForOrderAsync(new PayForOrderRequest
        {
            OrderId = orderId,
            ClientId = request.ClientId,
            PharmacyId = request.PharmacyId,
            Amount = estimatedCost,
            Currency = "TJS",
            Description = $"Checkout for order '{orderId}'.",
            IdempotencyKey = request.IdempotencyKey
        }, cancellationToken);

        if (!paymentResponse.IsPaid)
        {
            var reason = string.IsNullOrWhiteSpace(paymentResponse.FailureReason)
              ? paymentResponse.Status
              : paymentResponse.FailureReason;

            throw new InvalidOperationException(
              $"Payment failed for checkout. Reason: {reason}.");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        Order? order = null;
        try
        {
            foreach (var positionGroup in acceptedByMedicineId)
            {
                var affectedRows = await _dbContext.Offers
                  .Where(x =>
                    x.PharmacyId == request.PharmacyId &&
                    x.MedicineId == positionGroup.Key &&
                    x.StockQuantity >= positionGroup.Value)
                  .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                      x => x.StockQuantity,
                      x => x.StockQuantity - positionGroup.Value),
                    cancellationToken);

                if (affectedRows == 0)
                    throw new InvalidOperationException(
                      $"Insufficient stock due to concurrent checkout for medicine '{positionGroup.Key}' in pharmacy '{request.PharmacyId}'.");
            }

            var acceptedMedicineIds = acceptedByMedicineId.Keys.ToList();
            var currentOfferPrices = await _dbContext.Offers
              .AsNoTracking()
              .Where(x => x.PharmacyId == request.PharmacyId && acceptedMedicineIds.Contains(x.MedicineId))
              .ToDictionaryAsync(x => x.MedicineId, x => x.Price, cancellationToken);

            var orderPositions = evaluation.Positions
              .Select(x => new OrderPosition(
                orderId: orderId,
                medicineId: x.BasketPosition.MedicineId,
                medicine: x.BasketPosition.Medicine,
                offerSnapshot: new Domain.ValueObjects.OfferSnapshot(
                  request.PharmacyId,
                  currentOfferPrices.TryGetValue(x.BasketPosition.MedicineId, out var currentPrice)
                    ? currentPrice
                    : x.Price ?? 0m),
                quantity: x.BasketPosition.Quantity,
                isRejected: x.IsRejected))
              .ToList();

            var orderRequest = new CheckoutBasketRequest
            {
                ClientId = request.ClientId,
                PharmacyId = request.PharmacyId,
                IsPickup = request.IsPickup,
                DeliveryAddress = effectiveDeliveryAddress,
                IdempotencyKey = request.IdempotencyKey,
                IgnoredPositionIds = request.IgnoredPositionIds ?? []
            };

            order = orderRequest.ToDomain(orderId, orderPositions);

            foreach (var basketPosition in acceptedPositions)
                client.RemoveBasketPosition(basketPosition);

            _dbContext.BasketPositions.RemoveRange(acceptedPositions);

            client.AddOrder(order);
            _dbContext.Orders.Add(order);

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return order!.ToResponse();
    }

    public async Task<CheckoutPreviewResponse> PreviewCheckoutAsync(
      CheckoutBasketRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.PharmacyId == Guid.Empty)
            throw new DomainArgumentException("PharmacyId can't be empty.");

        var client = await _dbContext.Clients
          .AsNoTracking()
          .Include(x => x.BasketPositions)
          .ThenInclude(x => x.Medicine)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var basketPositions = client.BasketPositions.ToList();

        if (basketPositions.Count == 0)
        {
            return new CheckoutPreviewResponse
            {
                ClientId = request.ClientId,
                PharmacyId = request.PharmacyId,
                CanCheckout = false,
                TotalPositions = 0,
                AcceptedPositionsCount = 0,
                RejectedPositionsCount = 0,
                Cost = 0m,
                ReturnCost = 0m,
                Positions = []
            };
        }

        var pharmacy = await _dbContext.Pharmacies
          .AsNoTracking()
          .FirstOrDefaultAsync(x => x.Id == request.PharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{request.PharmacyId}' was not found.");

        var ignoredPositionIds = request.IgnoredPositionIds?.ToHashSet() ?? [];
        ValidateIgnoredPositionIds(basketPositions, ignoredPositionIds);

        var evaluation = await BuildCheckoutEvaluationAsync(
          basketPositions,
          request.PharmacyId,
          ignoredPositionIds,
          cancellationToken);

        var acceptedPositionsCount = evaluation.Positions.Count(x => !x.IsRejected);
        var rejectedPositionsCount = evaluation.Positions.Count(x => x.IsRejected);

        return new CheckoutPreviewResponse
        {
            ClientId = request.ClientId,
            PharmacyId = request.PharmacyId,
            CanCheckout = pharmacy.IsActive && evaluation.CanCheckout && acceptedPositionsCount > 0,
            TotalPositions = evaluation.Positions.Count,
            AcceptedPositionsCount = acceptedPositionsCount,
            RejectedPositionsCount = rejectedPositionsCount,
            Cost = evaluation.Positions
              .Where(x => !x.IsRejected)
              .Sum(x => (x.Price ?? 0m) * x.BasketPosition.Quantity),
            ReturnCost = evaluation.Positions
              .Where(x => x.IsRejected)
              .Sum(x => (x.Price ?? 0m) * x.BasketPosition.Quantity),
            Positions = evaluation.Positions
              .Select(x => new CheckoutPreviewPositionResponse
              {
                  PositionId = x.BasketPosition.Id,
                  MedicineId = x.BasketPosition.MedicineId,
                  Quantity = x.BasketPosition.Quantity,
                  IsRejected = x.IsRejected,
                  FoundQuantity = x.FoundQuantity,
                  Price = x.Price,
                  Reason = x.Reason
              })
              .ToList()
        };
    }

    private async Task<int> CountBasketItemsAsync(Guid clientId, CancellationToken cancellationToken)
    {
        return await _dbContext.BasketPositions
          .CountAsync(x => x.ClientId == clientId, cancellationToken);
    }

    private static void ValidateIgnoredPositionIds(
      IReadOnlyCollection<BasketPosition> basketPositions,
      IReadOnlySet<Guid> ignoredPositionIds)
    {
        if (ignoredPositionIds.Count == 0)
            return;

        var basketPositionIds = basketPositions
          .Select(x => x.Id)
          .ToHashSet();

        var invalidIgnoredIds = ignoredPositionIds
          .Where(x => !basketPositionIds.Contains(x))
          .ToList();

        if (invalidIgnoredIds.Count > 0)
            throw new InvalidOperationException(
              $"Ignored basket positions were not found in client basket: {string.Join(", ", invalidIgnoredIds)}.");
    }

    private async Task<CheckoutEvaluation> BuildCheckoutEvaluationAsync(
      IReadOnlyCollection<BasketPosition> basketPositions,
      Guid pharmacyId,
      IReadOnlySet<Guid> ignoredPositionIds,
      CancellationToken cancellationToken)
    {
        var medicineIds = basketPositions
          .Select(x => x.MedicineId)
          .Distinct()
          .ToList();

        var liveOffers = await _dbContext.Offers
          .AsNoTracking()
          .Where(x => x.PharmacyId == pharmacyId && medicineIds.Contains(x.MedicineId))
          .ToListAsync(cancellationToken);

        var liveOffersByMedicineId = liveOffers.ToDictionary(x => x.MedicineId, x => x);
        var positions = new List<CheckoutEvaluationPosition>(basketPositions.Count);
        var canCheckout = true;

        foreach (var basketPosition in basketPositions)
        {
            if (basketPosition.Medicine is null)
                throw new InvalidOperationException(
                  $"Medicine '{basketPosition.MedicineId}' was not loaded for basket position '{basketPosition.Id}'.");

            var ignoredByClient = ignoredPositionIds.Contains(basketPosition.Id);
            var hasOffer = liveOffersByMedicineId.TryGetValue(basketPosition.MedicineId, out var offer);
            var foundQuantity = hasOffer ? offer!.StockQuantity : 0;
            var price = hasOffer ? offer!.Price : (decimal?)null;
            var hasEnoughQuantity = hasOffer && foundQuantity >= basketPosition.Quantity;

            var reason = CheckoutRejectReason.Accepted;
            var isRejected = false;

            if (ignoredByClient)
            {
                isRejected = true;
                reason = CheckoutRejectReason.IgnoredByClient;
            }
            else if (!basketPosition.Medicine.IsActive)
            {
                isRejected = true;
                reason = CheckoutRejectReason.MedicineInactive;
                canCheckout = false;
            }
            else if (!hasOffer)
            {
                isRejected = true;
                reason = CheckoutRejectReason.OfferNotFound;
                canCheckout = false;
            }
            else if (!hasEnoughQuantity)
            {
                isRejected = true;
                reason = CheckoutRejectReason.InsufficientStock;
                canCheckout = false;
            }

            positions.Add(new CheckoutEvaluationPosition
            {
                BasketPosition = basketPosition,
                IsRejected = isRejected,
                Reason = reason,
                FoundQuantity = foundQuantity,
                Price = price
            });
        }

        return new CheckoutEvaluation
        {
            CanCheckout = canCheckout,
            Positions = positions
        };
    }

    private async Task<Dictionary<Guid, List<BasketPositionResponse>>> LoadBasicBasketPositionsByClientIdsAsync(
      IReadOnlyCollection<Guid> clientIds,
      CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
            return [];

        var basketPositions = await _dbContext.BasketPositions
          .AsNoTracking()
          .Where(x => clientIds.Contains(x.ClientId))
          .ToListAsync(cancellationToken);

        return basketPositions
          .GroupBy(x => x.ClientId)
          .ToDictionary(
            x => x.Key,
            x => x
              .Select(y => y.ToResponse())
              .ToList());
    }

    private async Task<IReadOnlyCollection<ClientOrderResponse>> LoadClientOrdersAsync(
      Guid clientId,
      CancellationToken cancellationToken)
    {
        return await _dbContext.Orders
          .AsNoTracking()
          .Where(x => x.ClientId == clientId)
          .OrderByDescending(x => x.OrderPlacedAt)
          .Select(x => x.ToClientOrderResponse())
          .ToListAsync(cancellationToken);
    }

    private async Task<Dictionary<Guid, List<ClientOrderResponse>>> LoadClientOrdersByClientIdsAsync(
      IReadOnlyCollection<Guid> clientIds,
      CancellationToken cancellationToken)
    {
        if (clientIds.Count == 0)
            return [];

        var orders = await _dbContext.Orders
          .AsNoTracking()
          .Where(x => clientIds.Contains(x.ClientId))
          .OrderByDescending(x => x.OrderPlacedAt)
          .ToListAsync(cancellationToken);

        return orders
          .GroupBy(x => x.ClientId)
          .ToDictionary(
            x => x.Key,
            x => x
              .Select(y => y.ToClientOrderResponse())
              .ToList());
    }

    private async Task<ClientBasketData> LoadBasketByClientIdAsync(
      Guid clientId,
      CancellationToken cancellationToken)
    {
        var basketPositions = await _dbContext.BasketPositions
          .AsNoTracking()
          .Where(x => x.ClientId == clientId)
          .ToListAsync(cancellationToken);

        var result = new ClientBasketData
        {
            Positions = basketPositions
              .Select(x => x.ToResponse())
              .ToList()
        };

        if (basketPositions.Count == 0)
            return result;

        var medicineIds = basketPositions
          .Select(x => x.MedicineId)
          .Distinct()
          .ToList();

        var pharmacies = await _dbContext.Pharmacies
          .AsNoTracking()
          .Select(x => new PharmacyProjection(x.Id, x.Title, x.IsActive))
          .ToListAsync(cancellationToken);

        if (pharmacies.Count == 0)
            return result;

        var offers = await _dbContext.Offers
          .AsNoTracking()
          .Where(x => medicineIds.Contains(x.MedicineId))
          .Select(x => new PharmacyOfferProjection(
            x.PharmacyId,
            x.MedicineId,
            x.Price,
            x.StockQuantity))
          .ToListAsync(cancellationToken);

        var offerLookup = offers.ToDictionary(
          x => (x.PharmacyId, x.MedicineId),
          x => x);

        var options = new List<BasketPharmacyOptionResponse>(pharmacies.Count);
        var totalMedicinesCount = basketPositions.Count;

        foreach (var pharmacy in pharmacies)
        {
            var foundMedicinesCount = 0;
            var enoughQuantityMedicinesCount = 0;
            var totalCost = 0m;
            var items = new List<BasketPharmacyItemResponse>(basketPositions.Count);

            foreach (var basketPosition in basketPositions)
            {
                if (!offerLookup.TryGetValue((pharmacy.PharmacyId, basketPosition.MedicineId), out var offer))
                {
                    items.Add(new BasketPharmacyItemResponse
                    {
                        MedicineId = basketPosition.MedicineId,
                        RequestedQuantity = basketPosition.Quantity,
                        IsFound = false,
                        FoundQuantity = 0,
                        HasEnoughQuantity = false,
                        Price = null
                    });

                    continue;
                }

                foundMedicinesCount++;

                var hasEnoughQuantity = offer.StockQuantity >= basketPosition.Quantity;
                if (hasEnoughQuantity)
                    enoughQuantityMedicinesCount++;

                totalCost += offer.Price * basketPosition.Quantity;

                items.Add(new BasketPharmacyItemResponse
                {
                    MedicineId = basketPosition.MedicineId,
                    RequestedQuantity = basketPosition.Quantity,
                    IsFound = true,
                    FoundQuantity = offer.StockQuantity,
                    HasEnoughQuantity = hasEnoughQuantity,
                    Price = offer.Price
                });
            }

            options.Add(new BasketPharmacyOptionResponse
            {
                PharmacyId = pharmacy.PharmacyId,
                PharmacyTitle = pharmacy.PharmacyTitle,
                PharmacyIsActive = pharmacy.IsActive,
                FoundMedicinesCount = foundMedicinesCount,
                TotalMedicinesCount = totalMedicinesCount,
                FoundMedicinesRatio = $"{foundMedicinesCount}/{totalMedicinesCount}",
                EnoughQuantityMedicinesCount = enoughQuantityMedicinesCount,
                IsAvailable = pharmacy.IsActive && enoughQuantityMedicinesCount == totalMedicinesCount,
                TotalCost = totalCost,
                Items = items
                  .OrderByDescending(x => x.HasEnoughQuantity)
                  .ThenByDescending(x => x.IsFound)
                  .ThenBy(x => x.MedicineId)
                  .ToList()
            });
        }

        result.PharmacyOptions = options
          .OrderByDescending(x => x.FoundMedicinesCount)
          .ThenByDescending(x => x.EnoughQuantityMedicinesCount)
          .ThenByDescending(x => x.TotalCost)
          .ThenBy(x => x.PharmacyTitle)
          .ToList();

        return result;
    }

    private sealed class ClientBasketData
    {
        public IReadOnlyCollection<BasketPositionResponse> Positions { get; set; } = [];
        public IReadOnlyCollection<BasketPharmacyOptionResponse> PharmacyOptions { get; set; } = [];
    }

    private sealed record PharmacyProjection(
      Guid PharmacyId,
      string PharmacyTitle,
      bool IsActive);

    private sealed record PharmacyOfferProjection(
      Guid PharmacyId,
      Guid MedicineId,
      decimal Price,
      int StockQuantity);

    private static class CheckoutRejectReason
    {
        public const string Accepted = "Accepted";
        public const string IgnoredByClient = "IgnoredByClient";
        public const string MedicineInactive = "MedicineInactive";
        public const string OfferNotFound = "OfferNotFound";
        public const string InsufficientStock = "InsufficientStock";
    }

    private sealed class CheckoutEvaluation
    {
        public bool CanCheckout { get; init; }
        public IReadOnlyCollection<CheckoutEvaluationPosition> Positions { get; init; } = [];
    }

    private sealed class CheckoutEvaluationPosition
    {
        public required BasketPosition BasketPosition { get; init; }
        public bool IsRejected { get; init; }
        public string Reason { get; init; } = string.Empty;
        public int FoundQuantity { get; init; }
        public decimal? Price { get; init; }
    }
}
