using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class UserReadService : IUserReadService
{
  private readonly IAppDbContext _dbContext;

  public UserReadService(IAppDbContext dbContext)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    _dbContext = dbContext;
  }

  public async Task<GetAllUsersResponse> GetAllUsersAsync(
    GetAllUsersRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var page = request.Page < 1 ? 1 : request.Page;
    var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;

    var query = _dbContext.Users
      .AsNoTracking()
      .AsQueryable();

    if (request.Role.HasValue)
      query = query.Where(x => x.Role == request.Role.Value);

    var normalizedQuery = request.Query.Trim();
    if (!string.IsNullOrWhiteSpace(normalizedQuery))
    {
      query = query.Where(x =>
        x.Name.Contains(normalizedQuery)
        || x.PhoneNumber.Contains(normalizedQuery)
        || (x.TelegramUsername != null && x.TelegramUsername.Contains(normalizedQuery)));
    }

    var totalCount = await query.CountAsync(cancellationToken);

    var users = await query
      .OrderBy(x => x.Role)
      .ThenBy(x => x.Name)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);

    var userIds = users.Select(x => x.Id).ToList();

    var adminsById = await _dbContext.PharmacyWorkers
      .AsNoTracking()
      .Include(x => x.Pharmacy)
      .Where(x => userIds.Contains(x.Id))
      .ToDictionaryAsync(x => x.Id, cancellationToken);

    var ordersByClientId = await _dbContext.Orders
      .AsNoTracking()
      .Where(x => x.ClientId.HasValue && userIds.Contains(x.ClientId.Value))
      .OrderByDescending(x => x.OrderPlacedAt)
      .GroupBy(x => x.ClientId)
      .ToDictionaryAsync(
        group => group.Key!.Value,
        group => (IReadOnlyCollection<UserOrderListItemResponse>)group
          .Select(order => new UserOrderListItemResponse
          {
            OrderId = order.Id,
            PharmacyId = order.PharmacyId,
            OrderPlacedAt = order.OrderPlacedAt,
            Status = order.Status,
            Cost = order.Cost
          })
          .ToList(),
        cancellationToken);

    return new GetAllUsersResponse
    {
      Role = request.Role,
      Page = page,
      PageSize = pageSize,
      TotalCount = totalCount,
      Users = users
        .Select(user =>
        {
          adminsById.TryGetValue(user.Id, out var admin);
          ordersByClientId.TryGetValue(user.Id, out var orders);

          return new UserListItemResponse
          {
            UserId = user.Id,
            Name = user.Name,
            PhoneNumber = user.PhoneNumber,
            Role = user.Role,
            IsActive = user.IsActive,
            AuthType = GetAuthType(user.PasswordHash),
            HasPasswordLogin = IsPasswordLogin(user.PasswordHash),
            AvatarUrl = user.AvatarUrl,
            Gender = user.Gender,
            DateOfBirth = user.DateOfBirth?.ToString("yyyy-MM-dd"),
            TelegramId = user.TelegramId,
            TelegramUsername = user.TelegramUsername,
            DeactivatedAtUtc = user.DeactivatedAtUtc,
            DeactivatedByUserId = user.DeactivatedByUserId,
            DeactivationReason = user.DeactivationReason,
            PharmacyId = admin?.PharmacyId,
            PharmacyTitle = admin?.Pharmacy?.Title ?? string.Empty,
            PharmacyIsActive = admin?.Pharmacy?.IsActive,
            Orders = orders ?? [],
            OrdersCount = orders?.Count ?? 0
          };
        })
        .ToList()
    };
  }

  private static bool IsPasswordLogin(string passwordHash)
    => !string.Equals(passwordHash, "OTP_AUTH", StringComparison.Ordinal)
      && !string.Equals(passwordHash, "TELEGRAM_AUTH", StringComparison.Ordinal);

  private static string GetAuthType(string passwordHash)
  {
    if (string.Equals(passwordHash, "OTP_AUTH", StringComparison.Ordinal)) return "OTP";
    if (string.Equals(passwordHash, "TELEGRAM_AUTH", StringComparison.Ordinal)) return "Telegram";
    return "Password";
  }
}
