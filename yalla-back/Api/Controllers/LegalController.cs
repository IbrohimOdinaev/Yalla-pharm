using Microsoft.AspNetCore.Mvc;
using Yalla.Application.Services;

namespace Api.Controllers;

[ApiController]
[Route("api/legal")]
public sealed class LegalController : ControllerBase
{
  private readonly IPrivacyPolicyService _privacyPolicyService;

  public LegalController(IPrivacyPolicyService privacyPolicyService)
  {
    _privacyPolicyService = privacyPolicyService;
  }

  /// <summary>
  /// Returns the current privacy-policy version metadata so callers
  /// can decide whether the logged-in client needs to (re-)accept.
  /// The policy markdown itself lives on the frontend
  /// (<c>yalla-farm-front/src/shared/legal/privacy-policy.md</c>) —
  /// this endpoint deliberately exposes only the version contract.
  /// Anonymous access so the registration screen can fetch it
  /// before the user has any token.
  /// </summary>
  [HttpGet("privacy-policy")]
  public IActionResult GetPrivacyPolicy()
  {
    return Ok(_privacyPolicyService.GetCurrent());
  }
}
