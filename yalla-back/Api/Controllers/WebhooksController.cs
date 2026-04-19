using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.Common;

namespace Api.Controllers;

[ApiController]
[Route("api/webhooks")]
public sealed class WebhooksController : ControllerBase
{
    private readonly IWooCommerceSyncService _syncService;
    private readonly WooCommerceOptions _options;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        IWooCommerceSyncService syncService,
        IOptions<WooCommerceOptions> options,
        ILogger<WebhooksController> logger)
    {
        _syncService = syncService;
        _options = options.Value;
        _logger = logger;
    }

    [HttpPost("woocommerce")]
    [AllowAnonymous]
    public async Task<IActionResult> WooCommerceWebhook(CancellationToken cancellationToken)
    {
        // Read raw body for signature verification
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(cancellationToken);

        // Verify signature (if secret is configured)
        if (!string.IsNullOrWhiteSpace(_options.WebhookSecret))
        {
            var signature = Request.Headers["X-WC-Webhook-Signature"].FirstOrDefault();
            if (string.IsNullOrEmpty(signature))
            {
                _logger.LogWarning("Webhook: Missing X-WC-Webhook-Signature header");
                return Unauthorized(new { error = "missing signature" });
            }

            if (!VerifySignature(body, signature))
            {
                _logger.LogWarning("Webhook: Signature mismatch. Received={Received}, Topic={Topic}",
                    signature, Request.Headers["X-WC-Webhook-Topic"].FirstOrDefault());
                return Unauthorized(new { error = "invalid signature" });
            }
        }

        // Check topic
        var topic = Request.Headers["X-WC-Webhook-Topic"].FirstOrDefault() ?? "";
        _logger.LogInformation("Webhook received: topic={Topic}, bodyLength={Length}", topic, body.Length);

        if (topic is not ("product.updated" or "product.created"))
        {
            // product.deleted or ping — acknowledge but skip
            return Ok(new { status = "ignored", topic });
        }

        // Parse payload
        WooCommerceWebhookPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<WooCommerceWebhookPayload>(body);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Webhook: Failed to parse payload");
            return BadRequest(new { error = "Invalid JSON" });
        }

        if (payload == null || payload.Id <= 0)
            return Ok(new { status = "skipped", reason = "no product id" });

        await _syncService.ProcessWebhookAsync(payload, cancellationToken);

        return Ok(new { status = "processed", productId = payload.Id });
    }

    private bool VerifySignature(string body, string signature)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.WebhookSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        var computed = Convert.ToBase64String(hash);
        return computed == signature;
    }
}
