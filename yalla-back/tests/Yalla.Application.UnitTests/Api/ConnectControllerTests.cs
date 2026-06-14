using System.Net;
using Api.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Yalla.Application.UnitTests.Api;

public sealed class ConnectControllerTests
{
  [Fact]
  public async Task CreatePartnerRequest_UsesIntegrationFormTelegramToken()
  {
    var handler = new CapturingTelegramHandler();
    var controller = CreateController(
      handler,
      new Dictionary<string, string?>
      {
        ["TELEGRAM_INTEGRATIONFORM_TOKEN"] = "integration-token",
        ["TELEGRAM_BOT_TOKEN"] = "legacy-token",
        ["TELEGRAM_CHAT_ID"] = "chat-1"
      });

    var result = await controller.CreatePartnerRequest(ValidRequest(), CancellationToken.None);

    Assert.IsType<OkObjectResult>(result);
    Assert.NotNull(handler.LastRequestUri);
    Assert.Contains("/botintegration-token/sendMessage", handler.LastRequestUri!.ToString(), StringComparison.Ordinal);
  }

  [Fact]
  public async Task CreatePartnerRequest_DoesNotFallBackToLegacyTelegramBotToken()
  {
    var handler = new CapturingTelegramHandler();
    var controller = CreateController(
      handler,
      new Dictionary<string, string?>
      {
        ["TELEGRAM_BOT_TOKEN"] = "legacy-token",
        ["TELEGRAM_CHAT_ID"] = "chat-1"
      });

    var result = await controller.CreatePartnerRequest(ValidRequest(), CancellationToken.None);

    var objectResult = Assert.IsType<ObjectResult>(result);
    Assert.Equal(500, objectResult.StatusCode);
    Assert.Null(handler.LastRequestUri);
  }

  private static ConnectController CreateController(
    CapturingTelegramHandler handler,
    IReadOnlyDictionary<string, string?> configurationValues)
  {
    var configuration = new ConfigurationBuilder()
      .AddInMemoryCollection(configurationValues)
      .Build();

    return new ConnectController(
      configuration,
      new StaticHttpClientFactory(new HttpClient(handler)),
      NullLogger<ConnectController>.Instance);
  }

  private static ConnectController.PartnerConnectRequest ValidRequest() => new()
  {
    FullName = "Али Вали",
    Phone = "992900000000",
    PharmacyName = "Аптека Сино",
    HasOneC = true
  };

  private sealed class StaticHttpClientFactory : IHttpClientFactory
  {
    private readonly HttpClient _client;

    public StaticHttpClientFactory(HttpClient client) => _client = client;

    public HttpClient CreateClient(string name) => _client;
  }

  private sealed class CapturingTelegramHandler : HttpMessageHandler
  {
    public Uri? LastRequestUri { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      LastRequestUri = request.RequestUri;
      return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
      {
        Content = new StringContent("""{"ok":true}""")
      });
    }
  }
}
