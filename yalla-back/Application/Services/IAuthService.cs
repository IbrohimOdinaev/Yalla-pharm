using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IAuthService
{
  Task<LoginResponse> LoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default);

  Task<LoginResponse> AdminLoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default);

  Task<LoginResponse> SuperAdminLoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default);

  Task<ChangePasswordResponse> ChangePasswordAsync(
    Guid userId,
    ChangePasswordRequest request,
    CancellationToken cancellationToken = default);

  Task<UpdateAdminProfileResponse> UpdateAdminProfileAsync(
    Guid adminId,
    UpdateAdminProfileRequest request,
    CancellationToken cancellationToken = default);

  Task<RequestClientOtpResponse> RequestClientOtpAsync(
    RequestClientOtpRequest request,
    CancellationToken cancellationToken = default);

  Task<LoginResponse> VerifyClientOtpAsync(
    VerifyClientOtpRequest request,
    CancellationToken cancellationToken = default);

  Task<RequestClientOtpResponse> ResendClientOtpAsync(
    ResendClientOtpRequest request,
    CancellationToken cancellationToken = default);
}
