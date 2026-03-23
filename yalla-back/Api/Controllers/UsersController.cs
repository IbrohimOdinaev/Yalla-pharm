using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Domain.Enums;

namespace Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = nameof(Role.SuperAdmin))]
public sealed class UsersController : ControllerBase
{
  private readonly IUserReadService _userReadService;

  public UsersController(IUserReadService userReadService)
  {
    _userReadService = userReadService;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll(
    [FromQuery] GetAllUsersRequest request,
    CancellationToken cancellationToken)
  {
    var response = await _userReadService.GetAllUsersAsync(request, cancellationToken);
    return Ok(response);
  }
}
