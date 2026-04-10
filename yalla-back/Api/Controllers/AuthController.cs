using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
  private readonly IAuthService _authService;
  private readonly ITelegramAuthService _telegramAuthService;

  public AuthController(IAuthService authService, ITelegramAuthService telegramAuthService)
  {
    _authService = authService;
    _telegramAuthService = telegramAuthService;
  }

  [HttpPost("login")]
  [AllowAnonymous]
  public async Task<IActionResult> Login(
    [FromBody] LoginRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.LoginAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("admin/login")]
  [AllowAnonymous]
  public async Task<IActionResult> AdminLogin(
    [FromBody] LoginRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.AdminLoginAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("super-admin/login")]
  [AllowAnonymous]
  public async Task<IActionResult> SuperAdminLogin(
    [FromBody] LoginRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.SuperAdminLoginAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("telegram/start")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-request")]
  public async Task<IActionResult> StartTelegramAuth(CancellationToken cancellationToken)
  {
    var response = await _telegramAuthService.StartAsync(cancellationToken);
    return Ok(response);
  }

  [HttpPost("telegram/complete")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-verify")]
  public async Task<IActionResult> CompleteTelegramAuth(
    [FromBody] CompleteTelegramAuthRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _telegramAuthService.CompleteAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpGet("telegram/poll")]
  [AllowAnonymous]
  public async Task<IActionResult> PollTelegramAuth(
    [FromQuery] string nonce,
    CancellationToken cancellationToken)
  {
    var response = await _telegramAuthService.PollAsync(nonce, cancellationToken);
    return Ok(response);
  }

  [HttpPost("change-password")]
  [Authorize(Roles = $"{nameof(Role.Client)},{nameof(Role.Admin)},{nameof(Role.SuperAdmin)}")]
  public async Task<IActionResult> ChangePassword(
    [FromBody] ChangePasswordRequest request,
    CancellationToken cancellationToken)
  {
    var userId = User.GetRequiredUserId();
    var response = await _authService.ChangePasswordAsync(userId, request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("otp/request")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-request")]
  public async Task<IActionResult> RequestClientOtp(
    [FromBody] RequestClientOtpRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.RequestClientOtpAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("otp/verify")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-verify")]
  public async Task<IActionResult> VerifyClientOtp(
    [FromBody] VerifyClientOtpRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.VerifyClientOtpAsync(request, cancellationToken);
    return Ok(response);
  }

  [HttpPost("otp/resend")]
  [AllowAnonymous]
  [EnableRateLimiting("sms-register-resend")]
  public async Task<IActionResult> ResendClientOtp(
    [FromBody] ResendClientOtpRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.ResendClientOtpAsync(request, cancellationToken);
    return Ok(response);
  }
}
