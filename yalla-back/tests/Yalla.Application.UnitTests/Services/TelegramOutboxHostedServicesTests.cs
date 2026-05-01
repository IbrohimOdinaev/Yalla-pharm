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
using Yalla.Infrastructure.Telegram;

namespace Yalla.Application.UnitTests.Services;

public sealed class TelegramOutboxHostedServicesTests
{
  [Fact]
  public async Task TelegramOutboxMessage_UniqueKey_ShouldPreventDuplicates()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;

    var orderId = Guid.NewGuid();
    db.TelegramOutboxMessages.Add(TelegramOutboxMessage.CreatePending(
      orderId, chatId: 12345, statusSnapshot: Status.UnderReview, message: "m1", nowUtc: DateTime.UtcNow));
    db.TelegramOutboxMessages.Add(TelegramOutboxMessage.CreatePending(
      orderId, chatId: 12345, statusSnapshot: Status.UnderReview, message: "m2", nowUtc: DateTime.UtcNow));

    await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
  }

  [Fact]
  public async Task Enqueue_ShouldSkipClientsWithoutTelegramId()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    await SeedOrderAsync(db, telegramId: null, status: Status.UnderReview);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, scriptedBot: new ScriptedTelegramBot());
    var enqueue = new OrderStatusTelegramEnqueueHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions { Enabled = true, BatchSize = 50, PollIntervalSeconds = 5 }),
      NullLogger<OrderStatusTelegramEnqueueHostedService>.Instance);

    await enqueue.RunOnceAsync(CancellationToken.None);

    Assert.Equal(0, await db.TelegramOutboxMessages.CountAsync());
  }

  [Theory]
  [InlineData(Status.UnderReview)]
  [InlineData(Status.Preparing)]
  [InlineData(Status.Ready)]
  [InlineData(Status.OnTheWay)]
  [InlineData(Status.DriverArrived)]
  [InlineData(Status.Delivered)]
  [InlineData(Status.PickedUp)]
  [InlineData(Status.Cancelled)]
  [InlineData(Status.Returned)]
  public async Task Enqueue_ShouldFireForAllClientFacingStatuses(Status status)
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    await SeedOrderAsync(db, telegramId: 999_111_222L, status: status);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, scriptedBot: new ScriptedTelegramBot());
    var enqueue = new OrderStatusTelegramEnqueueHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions { Enabled = true, BatchSize = 50, PollIntervalSeconds = 5 }),
      NullLogger<OrderStatusTelegramEnqueueHostedService>.Instance);

    await enqueue.RunOnceAsync(CancellationToken.None);

    var enqueued = await db.TelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(status, enqueued.StatusSnapshot);
    Assert.Equal(999_111_222L, enqueued.ChatId);
    Assert.Equal(TelegramOutboxState.Pending, enqueued.State);
    Assert.False(string.IsNullOrWhiteSpace(enqueued.Message));
  }

  [Fact]
  public async Task EnqueueThenDispatch_ShouldMarkSent_AndAvoidReenqueue()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    await SeedOrderAsync(db, telegramId: 999_111_222L, status: Status.UnderReview);
    db.ChangeTracker.Clear();

    var bot = new ScriptedTelegramBot();
    using var provider = BuildServiceProvider(db, bot);

    var enqueue = new OrderStatusTelegramEnqueueHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions { Enabled = true, BatchSize = 50, PollIntervalSeconds = 5 }),
      NullLogger<OrderStatusTelegramEnqueueHostedService>.Instance);

    await enqueue.RunOnceAsync(CancellationToken.None);
    Assert.Equal(1, await db.TelegramOutboxMessages.CountAsync());

    await enqueue.RunOnceAsync(CancellationToken.None);
    Assert.Equal(1, await db.TelegramOutboxMessages.CountAsync()); // dedup

    var dispatcher = new TelegramOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5,
        MaxAttempts = 5,
        RetryBackoffSeconds = 1,
        RetentionDays = 7
      }),
      NullLogger<TelegramOutboxDispatcherHostedService>.Instance);

    await dispatcher.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var msg = await db.TelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(TelegramOutboxState.Sent, msg.State);
    Assert.True(msg.SentAtUtc.HasValue);
    Assert.Equal(1, msg.AttemptCount);
    Assert.Single(bot.SentMessages);
    Assert.Equal(999_111_222L, bot.SentMessages[0].ChatId);
    Assert.Contains("UnderReview", msg.StatusSnapshot.ToString(), StringComparison.Ordinal);
  }

  [Fact]
  public async Task Dispatcher_When403_ShouldMarkFailedTerminally_NoRetry()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    var orderId = Guid.NewGuid();
    db.TelegramOutboxMessages.Add(TelegramOutboxMessage.CreatePending(
      orderId, 12345, Status.UnderReview, "msg", DateTime.UtcNow.AddMinutes(-1)));
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var bot = new ScriptedTelegramBot
    {
      NextException = new InvalidOperationException("Telegram bot API 'sendMessage' returned HTTP 403: bot was blocked by the user")
    };
    using var provider = BuildServiceProvider(db, bot);

    var dispatcher = new TelegramOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5,
        MaxAttempts = 5,
        RetryBackoffSeconds = 1,
        RetentionDays = 7
      }),
      NullLogger<TelegramOutboxDispatcherHostedService>.Instance);

    await dispatcher.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var msg = await db.TelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(TelegramOutboxState.Failed, msg.State);
    Assert.Equal("user_blocked", msg.LastErrorCode);
    // Dispatcher increments AttemptCount on claim (+1), then MarkFailed increments again (+1).
    // Total of 2 — same accounting the SMS dispatcher uses. The terminal classification
    // skips ScheduleRetry, so we never see a 3rd increment.
    Assert.Equal(2, msg.AttemptCount);
    Assert.Equal(1, bot.SendMessageCallCount); // not retried
  }

  [Fact]
  public async Task Dispatcher_When500_ShouldRetry_ThenSucceed()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    var orderId = Guid.NewGuid();
    db.TelegramOutboxMessages.Add(TelegramOutboxMessage.CreatePending(
      orderId, 12345, Status.OnTheWay, "msg", DateTime.UtcNow.AddMinutes(-1)));
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var bot = new ScriptedTelegramBot
    {
      NextException = new InvalidOperationException("Telegram bot API 'sendMessage' returned HTTP 500: server error")
    };
    using var provider = BuildServiceProvider(db, bot);

    var dispatcher = new TelegramOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new TelegramOutboxOptions
      {
        Enabled = true,
        BatchSize = 50,
        PollIntervalSeconds = 5,
        MaxAttempts = 5,
        RetryBackoffSeconds = 1,
        RetentionDays = 7
      }),
      NullLogger<TelegramOutboxDispatcherHostedService>.Instance);

    await dispatcher.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var afterFirst = await db.TelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(TelegramOutboxState.Pending, afterFirst.State);
    Assert.Equal("transport_error", afterFirst.LastErrorCode);
    Assert.True(afterFirst.NextAttemptAtUtc > DateTime.UtcNow);

    // Bot recovers; force NextAttempt due now and retry.
    bot.NextException = null;
    await db.Database.ExecuteSqlInterpolatedAsync(
      $"UPDATE telegram_outbox_messages SET next_attempt_at_utc = {DateTime.UtcNow.AddMinutes(-1)} WHERE id = {afterFirst.Id}");

    await dispatcher.RunOnceAsync(CancellationToken.None);

    db.ChangeTracker.Clear();
    var afterSecond = await db.TelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(TelegramOutboxState.Sent, afterSecond.State);
    Assert.Equal(2, bot.SendMessageCallCount);
  }

  // ─────────────── helpers ───────────────

  private static async Task SeedOrderAsync(AppDbContext db, long? telegramId, Status status)
  {
    var client = TestDbFactory.CreateClient("TG Client", "900222000");
    if (telegramId.HasValue)
      client.SetTelegramId(telegramId.Value);

    var superAdmin = TestDbFactory.CreateUser("SA", "900222001", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("P", "Dushanbe", superAdmin.Id);
    var medicine = TestDbFactory.CreateMedicine("Med", $"ART-TG-{Guid.NewGuid():N}");
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, 10, 15m);

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
        new OrderPosition(orderId, medicine.Id, medicine, new OfferSnapshot(pharmacy.Id, 15m), 1)
      ]);

    db.Orders.Add(order);
    client.AddOrder(order);
    await db.SaveChangesAsync();

    if (status != Status.New)
    {
      await db.Database.ExecuteSqlInterpolatedAsync(
        $"UPDATE orders SET status = {(int)status} WHERE id = {orderId}");
    }
  }

  private static ServiceProvider BuildServiceProvider(AppDbContext db, ITelegramBotApi scriptedBot)
  {
    return new ServiceCollection()
      .AddLogging()
      .AddSingleton(db)
      .AddSingleton<IOptions<SmsTemplatesOptions>>(Options.Create(new SmsTemplatesOptions { Provider = "OsonSms" }))
      .AddScoped<IOrderStatusSmsService, OrderStatusSmsService>()
      .AddSingleton(scriptedBot)
      .BuildServiceProvider();
  }

  private sealed class ScriptedTelegramBot : ITelegramBotApi
  {
    public List<(long ChatId, string Text)> SentMessages { get; } = new();
    public int SendMessageCallCount { get; private set; }
    public Exception? NextException { get; set; }

    public Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
    {
      SendMessageCallCount++;
      if (NextException is not null)
        throw NextException;

      SentMessages.Add((chatId, text));
      return Task.CompletedTask;
    }

    public Task<TelegramSentMessage> SendConfirmationPromptAsync(
      long chatId, string text, string confirmCallbackData, string cancelCallbackData,
      string confirmButtonText, string cancelButtonText, CancellationToken cancellationToken = default)
      => Task.FromResult(new TelegramSentMessage(chatId, 1));

    public Task EditMessageTextAsync(long chatId, int messageId, string newText, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task AnswerCallbackQueryAsync(string callbackQueryId, string? text = null, bool showAlert = false, CancellationToken cancellationToken = default)
      => Task.CompletedTask;

    public Task SetWebhookAsync(string url, string secretToken, CancellationToken cancellationToken = default)
      => Task.CompletedTask;
  }
}
