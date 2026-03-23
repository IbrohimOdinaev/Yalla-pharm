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
}
