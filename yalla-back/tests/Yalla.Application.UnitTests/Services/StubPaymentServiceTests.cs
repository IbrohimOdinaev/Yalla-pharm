using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;

namespace Yalla.Application.UnitTests.Services;

public sealed class StubPaymentServiceTests
{
  [Fact]
  public async Task PayForOrderAsync_ShouldGeneratePaymentUrl_WithAmountAndComment()
  {
    var service = new StubPaymentService(
      Options.Create(new DushanbeCityPaymentOptions
      {
        BaseUrl = "http://pay.expresspay.tj/?A=9762000087892609&s=&c=&f1=133&FIELD2=&FIELD3="
      }),
      new FakePaymentSettingsService());

    var orderId = Guid.NewGuid();
    var response = await service.PayForOrderAsync(new PayForOrderRequest
    {
      OrderId = orderId,
      ClientId = Guid.NewGuid(),
      ClientPhoneNumber = "992911223344",
      PharmacyId = Guid.NewGuid(),
      Amount = 155.5m,
      Currency = "TJS",
      IdempotencyKey = "checkout-key"
    });

    Assert.True(response.IsPaid);
    Assert.NotNull(response.PaymentUrl);

    var query = ParseQuery(new Uri(response.PaymentUrl!, UriKind.Absolute).Query);
    Assert.Equal("9762000087892609", query["A"]);
    Assert.Equal("155.50", query["s"]);
    Assert.Equal($"ClientNumber: 911223344 & OrderId: {orderId}", query["c"]);
    Assert.Equal("133", query["f1"]);
  }

  private static Dictionary<string, string> ParseQuery(string query)
  {
    var source = query.StartsWith('?') ? query[1..] : query;
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var segment in source.Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
      var equalsIndex = segment.IndexOf('=');
      if (equalsIndex < 0)
      {
        result[Uri.UnescapeDataString(segment)] = string.Empty;
        continue;
      }

      var key = Uri.UnescapeDataString(segment[..equalsIndex]);
      var value = Uri.UnescapeDataString(segment[(equalsIndex + 1)..]);
      result[key] = value;
    }

    return result;
  }
}
