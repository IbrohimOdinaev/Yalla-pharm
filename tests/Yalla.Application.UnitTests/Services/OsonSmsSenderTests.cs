using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Infrastructure.Sms;

namespace Yalla.Application.UnitTests.Services;

public sealed class OsonSmsSenderTests
{
  [Fact]
  public void OsonBearerSigner_ShouldSetAuthorizationHeader()
  {
    var signer = new OsonBearerSigner();
    var options = CreateOptions();
    var request = new HttpRequestMessage(HttpMethod.Get, "/sendsms_v1.php");
    var query = new List<(string Key, string Value)>();

    signer.Apply(
      request,
      query,
      options,
      new OsonRequestSigningContext
      {
        IsSendRequest = true,
        SendCommand = new SmsSendCommand
        {
          PhoneNumber = "900111222",
          Message = "code",
          TxnId = "txn-1"
        },
        NormalizedPhoneNumber = "992900111222"
      });

    Assert.NotNull(request.Headers.Authorization);
    Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
    Assert.Equal(options.Token, request.Headers.Authorization.Parameter);
  }

  [Fact]
  public void OsonHashSigner_ShouldAddTAndStrHash()
  {
    var signer = new OsonHashSigner();
    var options = CreateOptions();
    options.AuthMode = "Hash";
    options.PassSaltHash = "pass-hash";
    options.Delimiter = ";";
    options.T = "23";

    var request = new HttpRequestMessage(HttpMethod.Get, "/sendsms_v1.php");
    var query = new List<(string Key, string Value)>
    {
      ("from", options.Sender),
      ("phone_number", "992900111222"),
      ("msg", "code"),
      ("login", options.Login),
      ("txn_id", "txn-1")
    };

    signer.Apply(
      request,
      query,
      options,
      new OsonRequestSigningContext
      {
        IsSendRequest = true,
        SendCommand = new SmsSendCommand
        {
          PhoneNumber = "900111222",
          Message = "code",
          TxnId = "txn-1"
        },
        NormalizedPhoneNumber = "992900111222"
      });

    var expectedHash = ComputeSha256("txn-1;yalla;Yalla;992900111222;pass-hash");
    Assert.Contains(query, x => x.Key == "t" && x.Value == "23");
    Assert.Contains(query, x => x.Key == "str_hash" && x.Value == expectedHash);
    Assert.Null(request.Headers.Authorization);
  }

  [Fact]
  public async Task SendSmsAsync_WhenDuplicateTxnId_ShouldReturnMappedError()
  {
    var handler = new SequenceMessageHandler(
      _ => JsonResponse(
        HttpStatusCode.Conflict,
        """{"error":{"code":"108","msg":"Duplicate txn_id"}}"""));

    var sender = CreateSender(handler, CreateOptions());

    var result = await sender.SendSmsAsync(new SmsSendCommand
    {
      PhoneNumber = "900111222",
      Message = "test",
      TxnId = "txn-duplicate"
    });

    Assert.False(result.IsSuccess);
    Assert.Equal("duplicate_txn_id", result.ErrorCode);
    Assert.Equal(409, result.StatusCode);
  }

  [Fact]
  public async Task SendSmsAsync_WhenTransientProviderError_ShouldRetryAndSucceed()
  {
    var handler = new SequenceMessageHandler(
      _ => JsonResponse(
        HttpStatusCode.InternalServerError,
        """{"error":{"code":"500","msg":"temporary"}}"""),
      _ => JsonResponse(
        HttpStatusCode.Created,
        """{"status":"ok","txn_id":"txn-ok","msg_id":"msg-ok"}"""));

    var options = CreateOptions();
    options.MaxRetryAttempts = 1;
    options.RetryBackoffSeconds = 1;
    var sender = CreateSender(handler, options);

    var result = await sender.SendSmsAsync(new SmsSendCommand
    {
      PhoneNumber = "900111222",
      Message = "test",
      TxnId = "txn-ok"
    });

    Assert.True(result.IsSuccess);
    Assert.Equal(2, handler.CallCount);
    Assert.Equal("txn-ok", result.TxnId);
    Assert.Equal("msg-ok", result.MsgId);
  }

  [Fact]
  public async Task SendSmsAsync_WhenTransportFails_ShouldReturnTransportError()
  {
    var handler = new SequenceMessageHandler(
      _ => throw new HttpRequestException("connection failed"));

    var options = CreateOptions();
    options.MaxRetryAttempts = 0;
    var sender = CreateSender(handler, options);

    var result = await sender.SendSmsAsync(new SmsSendCommand
    {
      PhoneNumber = "900111222",
      Message = "test",
      TxnId = "txn-transport"
    });

    Assert.False(result.IsSuccess);
    Assert.Equal("transport_error", result.ErrorCode);
    Assert.Equal(0, result.StatusCode);
  }

  [Fact]
  public async Task SendSmsAsync_InHashMode_ShouldSendStrHashWithoutAuthorizationHeader()
  {
    var handler = new SequenceMessageHandler(request =>
    {
      Assert.Null(request.Headers.Authorization);
      var query = request.RequestUri?.Query ?? string.Empty;
      Assert.Contains("str_hash=", query, StringComparison.Ordinal);
      Assert.Contains("t=23", query, StringComparison.Ordinal);

      return JsonResponse(HttpStatusCode.Created, """{"status":"ok","txn_id":"txn-h","msg_id":"msg-h"}""");
    });

    var options = CreateOptions();
    options.AuthMode = "Hash";
    options.PassSaltHash = "pass-hash";
    options.Token = string.Empty;
    var sender = CreateSender(handler, options);

    var result = await sender.SendSmsAsync(new SmsSendCommand
    {
      PhoneNumber = "900111222",
      Message = "test",
      TxnId = "txn-h"
    });

    Assert.True(result.IsSuccess);
    Assert.Equal("txn-h", result.TxnId);
  }

  private static OsonSmsOptions CreateOptions()
  {
    return new OsonSmsOptions
    {
      ApiBaseUrl = "https://api.osonsms.com",
      AuthMode = "Bearer",
      Login = "yalla",
      Token = "token-1",
      Sender = "Yalla",
      IsConfidential = true,
      UseStub = false,
      TimeoutSeconds = 10,
      MaxRetryAttempts = 0,
      RetryBackoffSeconds = 1,
      Delimiter = ";",
      T = "23"
    };
  }

  private static OsonSmsSender CreateSender(HttpMessageHandler handler, OsonSmsOptions options)
  {
    var client = new HttpClient(handler)
    {
      BaseAddress = new Uri(options.ApiBaseUrl)
    };

    return new OsonSmsSender(
      client,
      Options.Create(options),
      [new OsonBearerSigner(), new OsonHashSigner()],
      NullLogger<OsonSmsSender>.Instance);
  }

  private static HttpResponseMessage JsonResponse(HttpStatusCode statusCode, string payload)
  {
    return new HttpResponseMessage(statusCode)
    {
      Content = new StringContent(payload, Encoding.UTF8, "application/json")
    };
  }

  private static string ComputeSha256(string value)
  {
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
    var builder = new StringBuilder(bytes.Length * 2);
    foreach (var item in bytes)
      builder.Append(item.ToString("x2"));
    return builder.ToString();
  }

  private sealed class SequenceMessageHandler : HttpMessageHandler
  {
    private readonly Queue<Func<HttpRequestMessage, HttpResponseMessage>> _handlers;

    public SequenceMessageHandler(params Func<HttpRequestMessage, HttpResponseMessage>[] handlers)
    {
      _handlers = new Queue<Func<HttpRequestMessage, HttpResponseMessage>>(handlers);
    }

    public int CallCount { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      CallCount++;

      if (_handlers.Count == 0)
        throw new InvalidOperationException("No more handler responses configured.");

      var current = _handlers.Dequeue();
      return Task.FromResult(current(request));
    }
  }
}
