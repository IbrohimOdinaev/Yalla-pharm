using Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
  private readonly IAuthService _authService;

  public AuthController(IAuthService authService)
  {
    _authService = authService;
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

  [HttpPost("telegram")]
  [AllowAnonymous]
  public async Task<IActionResult> TelegramLogin(
    [FromBody] TelegramLoginRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _authService.TelegramLoginAsync(request, cancellationToken);
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
}
