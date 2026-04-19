using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class ClientService : IClientService
{
  private readonly IAppDbContext _dbContext;
  private readonly IPaymentService _paymentService;
  private readonly IPasswordHasher _passwordHasher;
  private readonly ISmsService _smsService;
  private readonly SmsVerificationOptions _smsOptions;
  private readonly DushanbeCityPaymentOptions _paymentOptions;
  private readonly ILogger<ClientService> _logger;
  private readonly IRealtimeUpdatesPublisher _realtimeUpdatesPublisher;
  private readonly IClientAddressService _addressService;
  private readonly IJuraService? _juraService;

  public ClientService(
    IAppDbContext dbContext,
    IPaymentService paymentService,
    IPasswordHasher passwordHasher,
    ISmsService smsService,
    IOptions<SmsVerificationOptions> smsOptions,
    IOptions<DushanbeCityPaymentOptions> paymentOptions,
    ILogger<ClientService> logger,
    IRealtimeUpdatesPublisher realtimeUpdatesPublisher,
    IClientAddressService addressService,
    IJuraService? juraService = null)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(paymentService);
    ArgumentNullException.ThrowIfNull(passwordHasher);
    ArgumentNullException.ThrowIfNull(smsService);
    ArgumentNullException.ThrowIfNull(smsOptions);
    ArgumentNullException.ThrowIfNull(paymentOptions);
    ArgumentNullException.ThrowIfNull(logger);
    ArgumentNullException.ThrowIfNull(realtimeUpdatesPublisher);
    ArgumentNullException.ThrowIfNull(addressService);

    _dbContext = dbContext;
    _paymentService = paymentService;
    _passwordHasher = passwordHasher;
    _smsService = smsService;
    _smsOptions = smsOptions.Value;
    _paymentOptions = paymentOptions.Value;
    _logger = logger;
    _realtimeUpdatesPublisher = realtimeUpdatesPublisher;
    _addressService = addressService;
    _juraService = juraService;
  }

  public async Task<RegisterClientResponse> RegisterClientAsync(
    RegisterClientRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (_smsOptions.RegistrationEnabled && !request.SkipPhoneVerification)
    {
      throw new ClientErrorException(
        errorCode: "phone_verification_required",
        detail: "Требуется подтверждение телефона. Сначала запросите код, затем подтвердите его.",
        reason: "phone_verification_required");
    }

    if (request.SkipPhoneVerification && !_smsOptions.AllowRegistrationBypass)
      throw new ClientErrorException(
        errorCode: "phone_verification_bypass_disabled",
        detail: "Регистрация без подтверждения телефона отключена.",
        reason: "bypass_disabled");

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
    await EnsurePhoneIsAvailableAsync(normalizedPhoneNumber, cancellationToken);

    var passwordHash = HashPasswordOrThrow(request.Password);
    var client = request.ToDomain(normalizedPhoneNumber, passwordHash);

    _dbContext.Clients.Add(client);
    await _dbContext.SaveChangesAsync(cancellationToken);
    _logger.LogInformation(
      "Client registered without phone verification (bypass). ClientId={ClientId}, Phone={PhoneNumber}",
      client.Id,
      client.PhoneNumber);

    return new RegisterClientResponse
    {
      Client = client.ToResponse([], [])
    };
  }

  public async Task<RequestClientRegistrationVerificationResponse> RequestClientRegistrationVerificationAsync(
    RegisterClientRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (!_smsOptions.RegistrationEnabled)
      throw new ClientErrorException(
        errorCode: "phone_verification_disabled",
        detail: "Подтверждение телефона для регистрации отключено в текущем окружении.",
        reason: "verification_disabled");

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
    await EnsurePhoneIsAvailableAsync(normalizedPhoneNumber, cancellationToken);

    if (string.IsNullOrWhiteSpace(request.Name))
      throw new DomainArgumentException("Name can't be null or whitespace.");

    var passwordHash = HashPasswordOrThrow(request.Password);
    var payload = new ClientRegistrationPayload
    {
      Name = request.Name.Trim(),
      PhoneNumber = normalizedPhoneNumber,
      PasswordHash = passwordHash
    };

    var payloadJson = JsonSerializer.Serialize(payload);
    var smsResponse = await _smsService.SendSmsAsync(
      new SmsSendRequest
      {
        Purpose = SmsVerificationPurpose.ClientRegistration,
        PhoneNumber = normalizedPhoneNumber,
        PayloadJson = payloadJson
      },
      cancellationToken);

    _logger.LogInformation(
      "Registration verification requested. RegistrationId={RegistrationId}, Phone={PhoneNumber}",
      smsResponse.SessionId,
      smsResponse.PhoneNumber);

    return new RequestClientRegistrationVerificationResponse
    {
      RegistrationId = smsResponse.SessionId,
      PhoneNumber = smsResponse.PhoneNumber,
      ExpiresAtUtc = smsResponse.ExpiresAtUtc,
      ResendAvailableAtUtc = smsResponse.ResendAvailableAtUtc,
      CodeLength = smsResponse.CodeLength
    };
  }

  public async Task<RegisterClientResponse> VerifyClientRegistrationAsync(
    VerifyClientRegistrationRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var verificationResult = await _smsService.VerifySmsAsync(
      new SmsVerifyRequest
      {
        SessionId = request.RegistrationId,
        Code = request.Code
      },
      cancellationToken);

    if (!verificationResult.IsSuccess)
      throw CreateVerificationException(verificationResult.FailureReason);

    if (verificationResult.Purpose != SmsVerificationPurpose.ClientRegistration)
      throw new InvalidOperationException("Verification session purpose mismatch.");

    var payload = DeserializeRegistrationPayload(verificationResult.PayloadJson);
    await EnsurePhoneIsAvailableAsync(payload.PhoneNumber, cancellationToken);

    var client = new Client(
      payload.Name,
      payload.PhoneNumber,
      payload.PasswordHash);

    _dbContext.Clients.Add(client);
    await _dbContext.SaveChangesAsync(cancellationToken);
    _logger.LogInformation(
      "Client registration completed via SMS verification. ClientId={ClientId}, Phone={PhoneNumber}, RegistrationId={RegistrationId}",
      client.Id,
      client.PhoneNumber,
      request.RegistrationId);

    return new RegisterClientResponse
    {
      Client = client.ToResponse([], [])
    };
  }

  public async Task<RequestClientRegistrationVerificationResponse> ResendClientRegistrationVerificationAsync(
    ResendClientRegistrationRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var smsResponse = await _smsService.ResendSmsAsync(
      new SmsResendRequest
      {
        SessionId = request.RegistrationId
      },
      cancellationToken);

    _logger.LogInformation(
      "Registration verification code resent. RegistrationId={RegistrationId}, Phone={PhoneNumber}",
      smsResponse.SessionId,
      smsResponse.PhoneNumber);

    return new RequestClientRegistrationVerificationResponse
    {
      RegistrationId = smsResponse.SessionId,
      PhoneNumber = smsResponse.PhoneNumber,
      ExpiresAtUtc = smsResponse.ExpiresAtUtc,
      ResendAvailableAtUtc = smsResponse.ResendAvailableAtUtc,
      CodeLength = smsResponse.CodeLength
    };
  }

    public async Task<UpdateClientResponse> UpdateClientAsync(
      UpdateClientRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var client = await _dbContext.Clients
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        // PhoneNumber updates go through the dedicated OTP link flow — don't let
        // callers overwrite it via the generic profile update. If provided, it
        // must match what's already stored.
        var phoneToApply = string.Empty;
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
            if (normalizedPhoneNumber != client.PhoneNumber)
                throw new ClientErrorException(
                  errorCode: "phone_change_not_allowed",
                  detail: "Номер телефона меняется только через OTP-привязку в профиле.",
                  reason: "phone_change_not_allowed");
            phoneToApply = normalizedPhoneNumber;
        }

        request.ApplyToDomain(client, phoneToApply);

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

            if (client.BasketPositions.Count > 0)
            {
                var basketPositions = client.BasketPositions.ToList();

                foreach (var basketPosition in basketPositions)
                    client.RemoveBasketPosition(basketPosition);

                _dbContext.BasketPositions.RemoveRange(basketPositions);
            }

            if (client.Orders.Count > 0)
            {
                var trackedOrders = client.Orders.ToList();
                foreach (var order in trackedOrders)
                {
                    order.DetachClient(client.PhoneNumber);
                    client.RemoveOrder(order);
                }
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

            await _realtimeUpdatesPublisher.PublishBasketUpdatedAsync(request.ClientId, cancellationToken);

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

        await _realtimeUpdatesPublisher.PublishBasketUpdatedAsync(request.ClientId, cancellationToken);

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

        await _realtimeUpdatesPublisher.PublishBasketUpdatedAsync(request.ClientId, cancellationToken);

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

        await _realtimeUpdatesPublisher.PublishBasketUpdatedAsync(request.ClientId, cancellationToken);

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

        await _realtimeUpdatesPublisher.PublishBasketUpdatedAsync(request.ClientId, cancellationToken);

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

        var normalizedIdempotencyKey = (request.IdempotencyKey ?? string.Empty).Trim();

        if (normalizedIdempotencyKey.Length == 0)
            throw new DomainArgumentException("IdempotencyKey can't be null or whitespace.");

        // Idempotency — return an already-created order/intent for this key
        // (regardless of payment mode), so retries don't double-charge the client.
        var existingOrderByKey = await _dbContext.Orders
          .AsNoTracking()
          .FirstOrDefaultAsync(
            o => o.ClientId == request.ClientId && o.IdempotencyKey == normalizedIdempotencyKey,
            cancellationToken);
        if (existingOrderByKey is not null)
            return existingOrderByKey.ToResponse(existingOrderByKey.PaymentUrl);

        if (_paymentOptions.CreateOrderOnlyAfterAdminPaymentConfirmation)
        {
            var existingIntent = await _dbContext.PaymentIntents
              .AsNoTracking()
              .FirstOrDefaultAsync(
                x => x.ClientId == request.ClientId && x.IdempotencyKey == normalizedIdempotencyKey,
                cancellationToken);

            if (existingIntent is not null)
                return ToCheckoutPaymentIntentResponse(existingIntent);
        }

        var sourceKind = request.Source?.Kind ?? CheckoutSourceKind.Basket;

        var client = await _dbContext.Clients
          .AsTracking()
          .Include(x => x.BasketPositions)
          .ThenInclude(x => x.Medicine)
          .FirstOrDefaultAsync(x => x.Id == request.ClientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{request.ClientId}' was not found.");

        var drafts = await ResolvePositionDraftsAsync(client, request.Source, cancellationToken);

        if (drafts.Count == 0)
        {
            throw sourceKind switch
            {
                CheckoutSourceKind.Basket => new InvalidOperationException($"Client '{request.ClientId}' basket is empty."),
                CheckoutSourceKind.RepeatOrder => new InvalidOperationException("Repeat order has no positions."),
                _ => new InvalidOperationException("Checkout source provided no positions.")
            };
        }

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

        // IgnoredPositionIds is meaningful only for basket source (ids reference BasketPosition rows).
        var ignoredPositionIds = sourceKind == CheckoutSourceKind.Basket
          ? (request.IgnoredPositionIds?.ToHashSet() ?? [])
          : new HashSet<Guid>();
        if (sourceKind == CheckoutSourceKind.Basket)
            ValidateIgnoredPositionIds(client.BasketPositions, ignoredPositionIds);

        var evaluation = await BuildCheckoutEvaluationAsync(
          drafts,
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
                  $"Medicine '{firstBlocking.Draft.MedicineId}' is inactive and cannot be checked out."),
                CheckoutRejectReason.OfferNotFound => new InvalidOperationException(
                  $"Medicine '{firstBlocking.Draft.MedicineId}' is not available in pharmacy '{request.PharmacyId}'."),
                CheckoutRejectReason.InsufficientStock => new InvalidOperationException(
                  $"Quantity '{firstBlocking.Draft.Quantity}' exceeds stock '{firstBlocking.FoundQuantity}' for medicine '{firstBlocking.Draft.MedicineId}' in pharmacy '{request.PharmacyId}'."),
                _ => new InvalidOperationException("Checkout failed due to invalid basket state.")
            };
        }

        var acceptedDrafts = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Select(x => x.Draft)
          .ToList();

        if (acceptedDrafts.Count == 0)
            throw new InvalidOperationException("At least one position must be selected for checkout.");

        var effectivePhone = ResolveRecipientPhone(client);

        var acceptedByMedicineId = acceptedDrafts
          .GroupBy(x => x.MedicineId)
          .ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity));

        var itemsCost = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Sum(x => (x.Price ?? 0m) * x.Draft.Quantity);

        if (itemsCost <= 0m)
            throw new InvalidOperationException("Checkout total amount must be greater than zero.");

        var (deliveryCost, deliveryDistance) = await CalculateJuraDeliveryCostAsync(
          pharmacy, request, cancellationToken);
        var estimatedCost = itemsCost + deliveryCost;

        if (_paymentOptions.CreateOrderOnlyAfterAdminPaymentConfirmation)
        {
            return await CheckoutWithPaymentIntentAsync(
              request,
              client,
              pharmacy,
              effectiveDeliveryAddress,
              effectivePhone,
              evaluation,
              acceptedDrafts,
              estimatedCost,
              deliveryCost,
              deliveryDistance,
              sourceKind,
              cancellationToken);
        }

        var orderId = Guid.NewGuid();
        var paymentResponse = await _paymentService.PayForOrderAsync(new PayForOrderRequest
        {
            OrderId = orderId,
            ClientId = request.ClientId,
            ClientPhoneNumber = effectivePhone,
            PharmacyId = request.PharmacyId,
            Amount = estimatedCost,
            Currency = _paymentOptions.Currency,
            Description = $"Checkout for order '{orderId}'.",
            IdempotencyKey = normalizedIdempotencyKey
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
                medicineId: x.Draft.MedicineId,
                medicine: x.Draft.Medicine,
                offerSnapshot: new Domain.ValueObjects.OfferSnapshot(
                  request.PharmacyId,
                  currentOfferPrices.TryGetValue(x.Draft.MedicineId, out var currentPrice)
                    ? currentPrice
                    : x.Price ?? 0m),
                quantity: x.Draft.Quantity,
                isRejected: x.IsRejected))
              .ToList();

            var orderRequest = new CheckoutBasketRequest
            {
                ClientId = request.ClientId,
                PharmacyId = request.PharmacyId,
                IsPickup = request.IsPickup,
                DeliveryAddress = effectiveDeliveryAddress,
                IdempotencyKey = normalizedIdempotencyKey,
                IgnoredPositionIds = request.IgnoredPositionIds ?? [],
                Comment = request.Comment
            };

            order = orderRequest.ToDomain(orderId, effectivePhone, orderPositions);
            order.MarkManualPaymentPending(
              amount: estimatedCost,
              currency: _paymentOptions.Currency,
              provider: string.IsNullOrWhiteSpace(paymentResponse.Provider)
                ? _paymentOptions.ProviderName
                : paymentResponse.Provider,
              receiverAccount: paymentResponse.ReceiverAccount ?? string.Empty,
              paymentUrl: paymentResponse.PaymentUrl,
              paymentComment: paymentResponse.PaymentComment,
              expiresAtUtc: DateTime.UtcNow.AddMinutes(Math.Max(1, _paymentOptions.PendingConfirmationTimeoutMinutes)));

            // Basket cleanup — only when source is the basket.
            if (sourceKind == CheckoutSourceKind.Basket)
            {
                var basketIdsToRemove = acceptedDrafts
                    .Where(d => d.BasketPositionId.HasValue)
                    .Select(d => d.BasketPositionId!.Value)
                    .ToHashSet();
                var basketPositionsToRemove = client.BasketPositions
                    .Where(bp => basketIdsToRemove.Contains(bp.Id))
                    .ToList();
                foreach (var bp in basketPositionsToRemove)
                    client.RemoveBasketPosition(bp);
                _dbContext.BasketPositions.RemoveRange(basketPositionsToRemove);
            }

            client.AddOrder(order);
            _dbContext.Orders.Add(order);

            if (!request.IsPickup
              && request.DeliveryLatitude.HasValue
              && request.DeliveryLongitude.HasValue
              && pharmacy.Latitude.HasValue
              && pharmacy.Longitude.HasValue)
            {
                var deliveryData = new DeliveryData(
                  orderId: orderId,
                  fromTitle: pharmacy.Title,
                  fromAddress: pharmacy.Address,
                  fromLatitude: pharmacy.Latitude.Value,
                  fromLongitude: pharmacy.Longitude.Value,
                  toTitle: request.DeliveryAddressTitle ?? effectiveDeliveryAddress,
                  toAddress: effectiveDeliveryAddress,
                  toLatitude: request.DeliveryLatitude.Value,
                  toLongitude: request.DeliveryLongitude.Value,
                  fromAddressId: null,
                  toAddressId: request.DeliveryAddressId);
                deliveryData.SetDeliveryCost(deliveryCost, deliveryDistance);

                _dbContext.DeliveryData.Add(deliveryData);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        // Notify admins about new order
        await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
            order!.Id, order!.Status.ToString(), order!.ClientId, order!.PharmacyId, cancellationToken);

        return order!.ToResponse(paymentResponse.PaymentUrl);
    }

    private async Task<CheckoutBasketResponse> CheckoutWithPaymentIntentAsync(
      CheckoutBasketRequest request,
      Client client,
      Pharmacy pharmacy,
      string effectiveDeliveryAddress,
      string effectivePhone,
      CheckoutEvaluation evaluation,
      IReadOnlyCollection<PositionDraft> acceptedDrafts,
      decimal estimatedCost,
      decimal deliveryCost,
      double? deliveryDistance,
      CheckoutSourceKind sourceKind,
      CancellationToken cancellationToken)
    {
        var normalizedIdempotencyKey = (request.IdempotencyKey ?? string.Empty).Trim();
        if (normalizedIdempotencyKey.Length == 0)
            throw new DomainArgumentException("IdempotencyKey can't be null or whitespace.");

        var existingIntent = await _dbContext.PaymentIntents
          .AsNoTracking()
          .FirstOrDefaultAsync(
            x => x.ClientId == request.ClientId && x.IdempotencyKey == normalizedIdempotencyKey,
            cancellationToken);

        if (existingIntent is not null)
            return ToCheckoutPaymentIntentResponse(existingIntent);

        var reservedOrderId = Guid.NewGuid();
        var paymentResponse = await _paymentService.PayForOrderAsync(new PayForOrderRequest
        {
            OrderId = reservedOrderId,
            ClientId = request.ClientId,
            ClientPhoneNumber = effectivePhone,
            PharmacyId = request.PharmacyId,
            Amount = estimatedCost,
            Currency = _paymentOptions.Currency,
            Description = $"Checkout payment intent for reserved order '{reservedOrderId}'.",
            IdempotencyKey = normalizedIdempotencyKey
        }, cancellationToken);

        if (!paymentResponse.IsPaid)
        {
            var reason = string.IsNullOrWhiteSpace(paymentResponse.FailureReason)
              ? paymentResponse.Status
              : paymentResponse.FailureReason;

            throw new InvalidOperationException(
              $"Payment initialization failed for checkout. Reason: {reason}.");
        }

        var snapshotPositions = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Select(x => new PaymentIntentPosition(
            medicineId: x.Draft.MedicineId,
            offerPharmacyId: request.PharmacyId,
            offerPrice: x.Price ?? 0m,
            quantity: x.Draft.Quantity))
          .ToList();

        if (snapshotPositions.Count == 0)
            throw new InvalidOperationException("At least one accepted position is required to create payment intent.");

        if (snapshotPositions.Any(x => x.OfferPrice <= 0m))
            throw new InvalidOperationException("Payment intent snapshot contains invalid offer price.");

        var nowUtc = DateTime.UtcNow;
        var paymentIntent = new PaymentIntent(
          reservedOrderId: reservedOrderId,
          clientId: request.ClientId,
          clientPhoneNumber: effectivePhone,
          pharmacyId: request.PharmacyId,
          isPickup: request.IsPickup,
          deliveryAddress: effectiveDeliveryAddress,
          amount: estimatedCost,
          currency: _paymentOptions.Currency,
          paymentProvider: string.IsNullOrWhiteSpace(paymentResponse.Provider)
            ? _paymentOptions.ProviderName
            : paymentResponse.Provider,
          paymentReceiverAccount: paymentResponse.ReceiverAccount ?? string.Empty,
          paymentUrl: paymentResponse.PaymentUrl,
          paymentComment: paymentResponse.PaymentComment,
          idempotencyKey: normalizedIdempotencyKey,
          positions: snapshotPositions,
          createdAtUtc: nowUtc);

        var orderPositions = evaluation.Positions
          .Select(x => new OrderPosition(
            orderId: reservedOrderId,
            medicineId: x.Draft.MedicineId,
            medicine: x.Draft.Medicine,
            offerSnapshot: new Domain.ValueObjects.OfferSnapshot(
              request.PharmacyId,
              x.Price ?? 0m),
            quantity: x.Draft.Quantity,
            isRejected: x.IsRejected))
          .ToList();

        var orderRequest = new CheckoutBasketRequest
        {
            ClientId = request.ClientId,
            PharmacyId = request.PharmacyId,
            IsPickup = request.IsPickup,
            DeliveryAddress = effectiveDeliveryAddress,
            IdempotencyKey = normalizedIdempotencyKey,
            IgnoredPositionIds = request.IgnoredPositionIds ?? [],
            Comment = request.Comment
        };

        var order = orderRequest.ToDomain(reservedOrderId, effectivePhone, orderPositions);
        order.MarkManualPaymentPendingIndefinitely(
          amount: estimatedCost,
          currency: _paymentOptions.Currency,
          provider: string.IsNullOrWhiteSpace(paymentResponse.Provider)
            ? _paymentOptions.ProviderName
            : paymentResponse.Provider,
          receiverAccount: paymentResponse.ReceiverAccount ?? string.Empty,
          paymentUrl: paymentResponse.PaymentUrl,
          paymentComment: paymentResponse.PaymentComment);
        order.MarkStockNotDeducted();

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (sourceKind == CheckoutSourceKind.Basket)
            {
                var basketIdsToRemove = acceptedDrafts
                    .Where(d => d.BasketPositionId.HasValue)
                    .Select(d => d.BasketPositionId!.Value)
                    .ToHashSet();
                var basketPositionsToRemove = client.BasketPositions
                    .Where(bp => basketIdsToRemove.Contains(bp.Id))
                    .ToList();
                foreach (var bp in basketPositionsToRemove)
                    client.RemoveBasketPosition(bp);
                _dbContext.BasketPositions.RemoveRange(basketPositionsToRemove);
            }

            _dbContext.PaymentIntents.Add(paymentIntent);

            client.AddOrder(order);
            _dbContext.Orders.Add(order);

            if (!request.IsPickup
              && request.DeliveryLatitude.HasValue
              && request.DeliveryLongitude.HasValue
              && pharmacy.Latitude.HasValue
              && pharmacy.Longitude.HasValue)
            {
                var deliveryData = new DeliveryData(
                  orderId: reservedOrderId,
                  fromTitle: pharmacy.Title,
                  fromAddress: pharmacy.Address,
                  fromLatitude: pharmacy.Latitude.Value,
                  fromLongitude: pharmacy.Longitude.Value,
                  toTitle: request.DeliveryAddressTitle ?? effectiveDeliveryAddress,
                  toAddress: effectiveDeliveryAddress,
                  toLatitude: request.DeliveryLatitude.Value,
                  toLongitude: request.DeliveryLongitude.Value,
                  fromAddressId: null,
                  toAddressId: request.DeliveryAddressId);
                deliveryData.SetDeliveryCost(deliveryCost, deliveryDistance);

                _dbContext.DeliveryData.Add(deliveryData);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            var concurrentIntent = await _dbContext.PaymentIntents
              .AsNoTracking()
              .FirstOrDefaultAsync(
                x => x.ClientId == request.ClientId && x.IdempotencyKey == normalizedIdempotencyKey,
                cancellationToken);

            if (concurrentIntent is not null)
                return ToCheckoutPaymentIntentResponse(concurrentIntent, deliveryCost);

            throw;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        // Notify admins about new order (payment intent flow)
        await _realtimeUpdatesPublisher.PublishOrderStatusChangedAsync(
            order.Id, order.Status.ToString(), order.ClientId, order.PharmacyId, cancellationToken);
        await _realtimeUpdatesPublisher.PublishPaymentIntentUpdatedAsync(
            paymentIntent.Id, paymentIntent.ClientId, paymentIntent.State, order.Id, cancellationToken);

        return ToCheckoutPaymentIntentResponse(paymentIntent, deliveryCost);
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

        var drafts = await ResolvePositionDraftsAsync(client, request.Source, cancellationToken);

        if (drafts.Count == 0)
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

        var sourceKind = request.Source?.Kind ?? CheckoutSourceKind.Basket;
        var ignoredPositionIds = sourceKind == CheckoutSourceKind.Basket
          ? (request.IgnoredPositionIds?.ToHashSet() ?? [])
          : new HashSet<Guid>();
        if (sourceKind == CheckoutSourceKind.Basket)
            ValidateIgnoredPositionIds(client.BasketPositions, ignoredPositionIds);

        // Mirror the delivery-address validation from CheckoutBasketAsync so the
        // preview doesn't lie to the UI: if the real checkout would fail here,
        // CanCheckout must be false.
        var previewEffectiveAddress = request.IsPickup
          ? (request.PharmacyId == pharmacy.Id ? pharmacy.Address : string.Empty)?.Trim() ?? string.Empty
          : request.DeliveryAddress?.Trim() ?? string.Empty;
        var hasValidAddress = !string.IsNullOrWhiteSpace(previewEffectiveAddress);

        var evaluation = await BuildCheckoutEvaluationAsync(
          drafts,
          request.PharmacyId,
          ignoredPositionIds,
          cancellationToken);

        var acceptedPositionsCount = evaluation.Positions.Count(x => !x.IsRejected);
        var rejectedPositionsCount = evaluation.Positions.Count(x => x.IsRejected);

        var itemsCost = evaluation.Positions
          .Where(x => !x.IsRejected)
          .Sum(x => (x.Price ?? 0m) * x.Draft.Quantity);

        var (previewDeliveryCost, previewDeliveryDistance) = await CalculateJuraDeliveryCostAsync(
          pharmacy, request, cancellationToken);

        return new CheckoutPreviewResponse
        {
            ClientId = request.ClientId,
            PharmacyId = request.PharmacyId,
            CanCheckout = pharmacy.IsActive
              && evaluation.CanCheckout
              && acceptedPositionsCount > 0
              && hasValidAddress,
            TotalPositions = evaluation.Positions.Count,
            AcceptedPositionsCount = acceptedPositionsCount,
            RejectedPositionsCount = rejectedPositionsCount,
            Cost = itemsCost,
            ReturnCost = evaluation.Positions
              .Where(x => x.IsRejected)
              .Sum(x => (x.Price ?? 0m) * x.Draft.Quantity),
            DeliveryCost = previewDeliveryCost,
            DeliveryDistance = previewDeliveryDistance,
            TotalCost = itemsCost + previewDeliveryCost,
            Positions = evaluation.Positions
              .Select(x => new CheckoutPreviewPositionResponse
              {
                  PositionId = x.Draft.BasketPositionId ?? Guid.Empty,
                  MedicineId = x.Draft.MedicineId,
                  Quantity = x.Draft.Quantity,
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

    private async Task<(decimal cost, double? distance)> CalculateJuraDeliveryCostAsync(
      Pharmacy pharmacy,
      CheckoutBasketRequest request,
      CancellationToken ct)
    {
        if (_juraService is null
          || request.IsPickup
          || !request.DeliveryLatitude.HasValue
          || !request.DeliveryLongitude.HasValue
          || !pharmacy.Latitude.HasValue
          || !pharmacy.Longitude.HasValue)
        {
            return (0m, null);
        }

        try
        {
            var from = new JuraAddress
            {
                Title = pharmacy.Title,
                Address = pharmacy.Address,
                Lat = pharmacy.Latitude.Value,
                Lng = pharmacy.Longitude.Value
            };
            var to = new JuraAddress
            {
                Id = request.DeliveryAddressId,
                Title = request.DeliveryAddressTitle ?? request.DeliveryAddress,
                Address = request.DeliveryAddress,
                Lat = request.DeliveryLatitude.Value,
                Lng = request.DeliveryLongitude.Value
            };

            var result = await _juraService.CalculateDeliveryAsync(from, to, tariffId: null, clientPhone: null, ct);
            return (result.Amount, result.Distance);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
              "JURA delivery cost calculation failed for pharmacy {PharmacyId} — proceeding with zero cost",
              pharmacy.Id);
            return (0m, null);
        }
    }

    private static CheckoutBasketResponse ToCheckoutPaymentIntentResponse(
      PaymentIntent paymentIntent, decimal deliveryCost = 0m)
    {
        var itemsCost = paymentIntent.Amount - deliveryCost;
        return new CheckoutBasketResponse
        {
            ClientId = paymentIntent.ClientId,
            PaymentIntentId = paymentIntent.Id,
            ReservedOrderId = paymentIntent.ReservedOrderId,
            Currency = paymentIntent.Currency,
            CreatedAtUtc = paymentIntent.CreatedAtUtc,
            PaymentIntentState = paymentIntent.State,
            OrderId = paymentIntent.ReservedOrderId,
            OrderPlacedAt = paymentIntent.CreatedAtUtc,
            IsPickup = paymentIntent.IsPickup,
            DeliveryAddress = paymentIntent.DeliveryAddress,
            Status = Status.New,
            Cost = itemsCost > 0 ? itemsCost : paymentIntent.Amount,
            ReturnCost = 0m,
            DeliveryCost = deliveryCost,
            TotalCost = paymentIntent.Amount,
            PaymentState = paymentIntent.State == PaymentIntentState.Confirmed
              ? OrderPaymentState.Confirmed
              : OrderPaymentState.PendingManualConfirmation,
            PaymentExpiresAtUtc = null,
            PaymentUrl = paymentIntent.PaymentUrl
        };
    }

    /// <summary>
    /// Turns a <see cref="CheckoutSourceRequest"/> into a source-agnostic list of
    /// <see cref="PositionDraft"/>. For basket source keeps the
    /// <see cref="PositionDraft.BasketPositionId"/> linkage so downstream code can
    /// clean up the right rows; for other sources this stays null.
    /// </summary>
    private async Task<IReadOnlyList<PositionDraft>> ResolvePositionDraftsAsync(
      Client client,
      CheckoutSourceRequest? source,
      CancellationToken cancellationToken)
    {
        var kind = source?.Kind ?? CheckoutSourceKind.Basket;

        switch (kind)
        {
            case CheckoutSourceKind.Basket:
                return client.BasketPositions
                    .Where(bp => bp.Medicine != null)
                    .Select(bp => new PositionDraft
                    {
                        MedicineId = bp.MedicineId,
                        Quantity = bp.Quantity,
                        Medicine = bp.Medicine!,
                        BasketPositionId = bp.Id
                    })
                    .ToList();

            case CheckoutSourceKind.RepeatOrder:
                if (source?.RepeatOfOrderId is null || source.RepeatOfOrderId == Guid.Empty)
                    throw new DomainArgumentException("Source.RepeatOfOrderId is required for RepeatOrder source.");

                // Read original positions without tracking (we don't want to mutate
                // the source order). Medicines are fetched separately as TRACKED
                // so the new Order can safely reference them without EF trying to
                // INSERT duplicates.
                var originalOrder = await _dbContext.Orders
                    .AsNoTracking()
                    .Include(o => o.Positions)
                    .FirstOrDefaultAsync(
                        o => o.Id == source.RepeatOfOrderId && o.ClientId == client.Id,
                        cancellationToken)
                    ?? throw new ClientErrorException(
                        errorCode: "repeat_order_not_found",
                        detail: "Исходный заказ не найден или не принадлежит вам.",
                        reason: "order_not_found");

                var repeatMedIds = originalOrder.Positions
                    .Where(p => !p.IsRejected)
                    .Select(p => p.MedicineId)
                    .Distinct()
                    .ToList();

                var repeatMedicines = await _dbContext.Medicines
                    .AsTracking()
                    .Where(m => repeatMedIds.Contains(m.Id))
                    .ToDictionaryAsync(m => m.Id, cancellationToken);

                var repeatGrouped = originalOrder.Positions
                    .Where(p => !p.IsRejected && repeatMedicines.ContainsKey(p.MedicineId))
                    .GroupBy(p => p.MedicineId)
                    .Select(g => new { MedicineId = g.Key, Quantity = g.Sum(x => x.Quantity) })
                    .ToList();

                return repeatGrouped
                    .Select(g => new PositionDraft
                    {
                        MedicineId = g.MedicineId,
                        Quantity = g.Quantity,
                        Medicine = repeatMedicines[g.MedicineId],
                        BasketPositionId = null
                    })
                    .ToList();

            case CheckoutSourceKind.Explicit:
                var reqPositions = source?.Positions;
                if (reqPositions is null || reqPositions.Count == 0)
                    throw new DomainArgumentException("Source.Positions is required for Explicit source.");

                // Validate and dedupe by medicineId (sum quantities).
                var byMedicine = new Dictionary<Guid, int>();
                foreach (var p in reqPositions)
                {
                    if (p.MedicineId == Guid.Empty)
                        throw new DomainArgumentException("Explicit position MedicineId can't be empty.");
                    if (p.Quantity <= 0)
                        throw new DomainArgumentException("Explicit position Quantity must be greater than zero.");
                    byMedicine[p.MedicineId] = byMedicine.GetValueOrDefault(p.MedicineId) + p.Quantity;
                }

                var medIds = byMedicine.Keys.ToList();
                var medicines = await _dbContext.Medicines
                    .AsTracking()
                    .Where(m => medIds.Contains(m.Id))
                    .ToDictionaryAsync(m => m.Id, cancellationToken);

                var missing = medIds.Where(id => !medicines.ContainsKey(id)).ToList();
                if (missing.Count > 0)
                    throw new ClientErrorException(
                        errorCode: "medicine_not_found",
                        detail: $"Лекарства не найдены: {string.Join(", ", missing)}.",
                        reason: "medicine_not_found");

                return byMedicine
                    .Select(kv => new PositionDraft
                    {
                        MedicineId = kv.Key,
                        Quantity = kv.Value,
                        Medicine = medicines[kv.Key],
                        BasketPositionId = null
                    })
                    .ToList();

            default:
                throw new DomainArgumentException($"Unsupported checkout source kind: {kind}.");
        }
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
      IReadOnlyCollection<PositionDraft> drafts,
      Guid pharmacyId,
      IReadOnlySet<Guid> ignoredPositionIds,
      CancellationToken cancellationToken)
    {
        var medicineIds = drafts
          .Select(x => x.MedicineId)
          .Distinct()
          .ToList();

        var liveOffers = await _dbContext.Offers
          .AsNoTracking()
          .Where(x => x.PharmacyId == pharmacyId && medicineIds.Contains(x.MedicineId))
          .ToListAsync(cancellationToken);

        var liveOffersByMedicineId = liveOffers.ToDictionary(x => x.MedicineId, x => x);
        var positions = new List<CheckoutEvaluationPosition>(drafts.Count);
        var canCheckout = true;

        foreach (var draft in drafts)
        {
            if (draft.Medicine is null)
                throw new InvalidOperationException(
                  $"Medicine '{draft.MedicineId}' was not loaded for draft position.");

            var ignoredByClient = draft.BasketPositionId.HasValue
              && ignoredPositionIds.Contains(draft.BasketPositionId.Value);
            var hasOffer = liveOffersByMedicineId.TryGetValue(draft.MedicineId, out var offer);
            var foundQuantity = hasOffer ? offer!.StockQuantity : 0;
            var price = hasOffer ? offer!.Price : (decimal?)null;
            var hasEnoughQuantity = hasOffer && foundQuantity >= draft.Quantity;

            var reason = CheckoutRejectReason.Accepted;
            var isRejected = false;

            if (ignoredByClient)
            {
                isRejected = true;
                reason = CheckoutRejectReason.IgnoredByClient;
            }
            else if (!draft.Medicine.IsActive)
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
                Draft = draft,
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
          .Where(x => x.ClientId.HasValue && clientIds.Contains(x.ClientId.Value))
          .OrderByDescending(x => x.OrderPlacedAt)
          .ToListAsync(cancellationToken);

        return orders
          .Where(x => x.ClientId.HasValue)
          .GroupBy(x => x.ClientId!.Value)
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

    private async Task EnsurePhoneIsAvailableAsync(
      string normalizedPhoneNumber,
      CancellationToken cancellationToken)
    {
        var phoneExists = await _dbContext.Users
          .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

        if (phoneExists)
            throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");
    }

    private string HashPasswordOrThrow(string password)
    {
        UserInputPolicy.EnsureValidPassword(password, nameof(password));
        var passwordHash = _passwordHasher.HashPassword(password);
        if (!_passwordHasher.VerifyPassword(password, passwordHash))
            throw new InvalidOperationException("Password hashing verification failed.");

        return passwordHash;
    }

    private static ClientRegistrationPayload DeserializeRegistrationPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
            throw new InvalidOperationException("Verification payload is missing.");

        var payload = JsonSerializer.Deserialize<ClientRegistrationPayload>(payloadJson);
        if (payload is null
          || string.IsNullOrWhiteSpace(payload.Name)
          || string.IsNullOrWhiteSpace(payload.PhoneNumber)
          || string.IsNullOrWhiteSpace(payload.PasswordHash))
        {
            throw new InvalidOperationException("Verification payload is invalid.");
        }

        return payload;
    }

    private static Exception CreateVerificationException(SmsVerificationFailureReason reason)
    {
        return reason switch
        {
            SmsVerificationFailureReason.NotFound => new ClientErrorException(
              errorCode: "sms_session_not_found",
              detail: "Сессия подтверждения не найдена. Запросите новый код.",
              reason: "session_not_found"),
            SmsVerificationFailureReason.InvalidCode => new ClientErrorException(
              errorCode: "sms_code_invalid",
              detail: "Код подтверждения введен неверно.",
              reason: "invalid_code"),
            SmsVerificationFailureReason.Expired => new ClientErrorException(
              errorCode: "sms_code_expired",
              detail: "Срок действия кода истек. Запросите новый код.",
              reason: "expired"),
            SmsVerificationFailureReason.AttemptsExceeded => new ClientErrorException(
              errorCode: "sms_attempts_exceeded",
              detail: "Лимит попыток ввода кода исчерпан. Запросите новый код.",
              reason: "attempts_exceeded"),
            SmsVerificationFailureReason.AlreadyCompleted => new ClientErrorException(
              errorCode: "sms_session_already_completed",
              detail: "Эта сессия подтверждения уже завершена. Начните регистрацию заново.",
              reason: "already_completed"),
            _ => new ClientErrorException(
              errorCode: "sms_verification_failed",
              detail: "Подтверждение номера не удалось.",
              reason: "verification_failed")
        };
    }

    private sealed class ClientRegistrationPayload
    {
        public string Name { get; init; } = string.Empty;
        public string PhoneNumber { get; init; } = string.Empty;
        public string PasswordHash { get; init; } = string.Empty;
    }

    /// <summary>
    /// Resolves the phone number to record with the order/payment. Returns an
    /// empty string for Telegram-only accounts — phone is optional as long as
    /// the client has at least one contact channel (phone OR Telegram).
    /// </summary>
    private static string ResolveRecipientPhone(Client client)
    {
        var stored = client.PhoneNumber ?? string.Empty;
        var storedIsSynthetic = stored.StartsWith("tg_", StringComparison.Ordinal);

        if (!storedIsSynthetic && !string.IsNullOrWhiteSpace(stored))
            return UserInputPolicy.NormalizePhoneNumber(stored);

        // No real phone — need at least a Telegram id to reach the client.
        if (!client.TelegramId.HasValue)
            throw new ClientErrorException(
              errorCode: "no_contact_channel",
              detail: "Привяжите номер телефона или Telegram-аккаунт в профиле.",
              reason: "no_contact_channel");

        return string.Empty;
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
        public required PositionDraft Draft { get; init; }
        public bool IsRejected { get; init; }
        public string Reason { get; init; } = string.Empty;
        public int FoundQuantity { get; init; }
        public decimal? Price { get; init; }
    }
}
