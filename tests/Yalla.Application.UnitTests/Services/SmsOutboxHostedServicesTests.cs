using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Sms;

namespace Yalla.Application.UnitTests.Services;

public sealed class SmsOutboxHostedServicesTests
{
  [Fact]
  public async Task SmsOutboxMessage_UniqueKey_ShouldPreventDuplicates()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var orderId = Guid.NewGuid();
    var first = SmsOutboxMessage.CreatePending(
      orderId: orderId,
      phoneNumber: "900111222",
      statusSnapshot: Status.UnderReview,
      message: "m1",
      provider: "OsonSms",
      nowUtc: DateTime.UtcNow);

    var second = SmsOutboxMessage.CreatePending(
      orderId: orderId,
      phoneNumber: "900111222",
      statusSnapshot: Status.UnderReview,
      message: "m2",
      provider: "OsonSms",
      nowUtc: DateTime.UtcNow);

    db.SmsOutboxMessages.Add(first);
    db.SmsOutboxMessages.Add(second);

    await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
  }

  [Fact]
  public async Task EnqueueThenDispatch_ShouldAvoidDuplicates_AndMarkSent()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    await SeedOrderAsync(db);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, smsSender: null);

    var enqueueService = new OrderStatusSmsEnqueueHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new SmsOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5
      }),
      Options.Create(new SmsTemplatesOptions
      {
        Provider = "OsonSms"
      }),
      NullLogger<OrderStatusSmsEnqueueHostedService>.Instance);

    await enqueueService.RunOnceAsync(CancellationToken.None);

    var firstEnqueueCount = await db.SmsOutboxMessages.CountAsync();
    Assert.Equal(1, firstEnqueueCount);

    await enqueueService.RunOnceAsync(CancellationToken.None);

    var secondEnqueueCount = await db.SmsOutboxMessages.CountAsync();
    Assert.Equal(1, secondEnqueueCount);

    var dispatcherService = new SmsOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new SmsOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5,
        MaxAttempts = 5,
        RetryBackoffSeconds = 1,
        RetentionDays = 7
      }),
      NullLogger<SmsOutboxDispatcherHostedService>.Instance);

    await dispatcherService.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var message = await db.SmsOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(SmsOutboxState.Sent, message.State);
    Assert.True(message.SentAtUtc.HasValue);
    Assert.Equal(1, message.AttemptCount);
    Assert.False(string.IsNullOrWhiteSpace(message.TxnId));
    Assert.False(string.IsNullOrWhiteSpace(message.MsgId));
  }

  [Fact]
  public async Task Dispatcher_WhenTransientError_ShouldRetryThenSend()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;

    var outboxMessage = SmsOutboxMessage.CreatePending(
      orderId: Guid.NewGuid(),
      phoneNumber: "900111333",
      statusSnapshot: Status.New,
      message: "retry-message",
      provider: "OsonSms",
      nowUtc: DateTime.UtcNow.AddMinutes(-1));
    db.SmsOutboxMessages.Add(outboxMessage);
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var scriptedSender = new ScriptedSmsSender(
      new SmsSendResult
      {
        IsSuccess = false,
        StatusCode = 503,
        ErrorCode = "transport_error",
        ErrorMessage = "temporary"
      },
      new SmsSendResult
      {
        IsSuccess = true,
        StatusCode = 201,
        TxnId = "txn-ok",
        MsgId = "msg-ok"
      });

    using var provider = BuildServiceProvider(db, scriptedSender);
    var dispatcherService = new SmsOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new SmsOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5,
        MaxAttempts = 5,
        RetryBackoffSeconds = 1,
        RetentionDays = 7
      }),
      NullLogger<SmsOutboxDispatcherHostedService>.Instance);

    await dispatcherService.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var afterFirstRun = await db.SmsOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(SmsOutboxState.Pending, afterFirstRun.State);
    Assert.Equal(2, afterFirstRun.AttemptCount);
    Assert.Equal("transport_error", afterFirstRun.LastErrorCode);
    Assert.True(afterFirstRun.NextAttemptAtUtc > DateTime.UtcNow);

    await db.Database.ExecuteSqlInterpolatedAsync(
      $"UPDATE sms_outbox_messages SET next_attempt_at_utc = {DateTime.UtcNow.AddMinutes(-1)} WHERE id = {afterFirstRun.Id}");

    await dispatcherService.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var afterSecondRun = await db.SmsOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(SmsOutboxState.Sent, afterSecondRun.State);
    Assert.Equal(3, afterSecondRun.AttemptCount);
    Assert.Equal("txn-ok", afterSecondRun.TxnId);
    Assert.Equal("msg-ok", afterSecondRun.MsgId);
    Assert.Equal(2, scriptedSender.CallCount);
  }

  private static async Task SeedOrderAsync(AppDbContext db)
  {
    var client = TestDbFactory.CreateClient("Client Sms", "900777111");
    var superAdmin = TestDbFactory.CreateUser("SuperAdmin Sms", "900777112", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy Sms", "Dushanbe", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Medicine Sms", "ART-SMS-1");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 10, price: 12m);

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.Medicines.Add(medicine);
    db.Offers.Add(offer);
    await db.SaveChangesAsync();

    var orderId = Guid.NewGuid();
    var order = new Order(
      id: orderId,
      clientId: client.Id,
      clientPhoneNumber: client.PhoneNumber,
      pharmacyId: pharmacy.Id,
      deliveryAddress: "Dushanbe",
      positions:
      [
        new OrderPosition(
          orderId: orderId,
          medicineId: medicine.Id,
          medicine: medicine,
          offerSnapshot: new OfferSnapshot(pharmacy.Id, 12m),
          quantity: 1)
      ]);

    db.Orders.Add(order);
    client.AddOrder(order);
    await db.SaveChangesAsync();
  }

  private static ServiceProvider BuildServiceProvider(AppDbContext db, ISmsSender? smsSender)
  {
    var services = new ServiceCollection()
      .AddLogging()
      .AddSingleton(db)
      .AddSingleton<IOptions<SmsTemplatesOptions>>(Options.Create(new SmsTemplatesOptions
      {
        Provider = "OsonSms"
      }))
      .AddScoped<IOrderStatusSmsService, OrderStatusSmsService>();

    if (smsSender is null)
      services.AddScoped<ISmsSender, StubSmsSender>();
    else
      services.AddSingleton(smsSender);

    return services.BuildServiceProvider();
  }

  private sealed class ScriptedSmsSender : ISmsSender
  {
    private readonly Queue<SmsSendResult> _results;

    public ScriptedSmsSender(params SmsSendResult[] results)
    {
      _results = new Queue<SmsSendResult>(results);
    }

    public int CallCount { get; private set; }

    public Task<SmsSendResult> SendSmsAsync(
      SmsSendCommand command,
      CancellationToken cancellationToken = default)
    {
      CallCount++;
      if (_results.Count == 0)
      {
        return Task.FromResult(new SmsSendResult
        {
          IsSuccess = true,
          StatusCode = 201,
          TxnId = command.TxnId,
          MsgId = "msg-default"
        });
      }

      return Task.FromResult(_results.Dequeue());
    }

    public Task<SmsDeliveryVerificationResult> VerifySmsAsync(
      SmsDeliveryVerificationCommand command,
      CancellationToken cancellationToken = default)
    {
      return Task.FromResult(new SmsDeliveryVerificationResult
      {
        IsSuccess = true,
        StatusCode = 200,
        DeliveryStatus = "DELIVERED"
      });
    }
  }
}
