using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/webhooks")]
public sealed class WebhooksController : ControllerBase
{
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(ILogger<WebhooksController> logger)
    {
        _logger = logger;
    }

    [HttpPost("woocommerce")]
    [AllowAnonymous]
    public IActionResult WooCommerceWebhook()
    {
        var topic = Request.Headers["X-WC-Webhook-Topic"].FirstOrDefault() ?? "";
        _logger.LogInformation(
            "WooCommerce webhook removed; request acknowledged without offer updates. topic={Topic}, contentLength={Length}",
            topic,
            Request.ContentLength ?? 0);

        return Ok(new
        {
            status = "removed",
            topic,
            message = "WooCommerce offer webhook is disabled; offers are no longer updated from WordPress webhooks."
        });
    }
}
