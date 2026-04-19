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

  /// <summary>
  /// Starts an SMS OTP session for attaching a phone number to an already
  /// authenticated client (e.g. a Telegram-only account).
  /// </summary>
  Task<RequestClientOtpResponse> RequestPhoneLinkOtpAsync(
    Guid clientId,
    string phoneNumber,
    CancellationToken cancellationToken = default);

  /// <summary>
  /// Verifies the SMS code and attaches the phone number to the client.
  /// Returns the same profile shape as login for frontend convenience.
  /// </summary>
  Task<LoginResponse> VerifyPhoneLinkOtpAsync(
    Guid clientId,
    Guid otpSessionId,
    string code,
    CancellationToken cancellationToken = default);
}
