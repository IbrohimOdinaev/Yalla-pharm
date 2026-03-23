using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IUserReadService
{
  Task<GetAllUsersResponse> GetAllUsersAsync(
    GetAllUsersRequest request,
    CancellationToken cancellationToken = default);
}
