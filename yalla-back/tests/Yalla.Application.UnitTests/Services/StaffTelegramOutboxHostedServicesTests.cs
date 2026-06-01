using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Telegram;

namespace Yalla.Application.UnitTests.Services;

public sealed class StaffTelegramOutboxHostedServicesTests
{
  [Fact]
  public async Task Enqueue_ShouldNotifyPharmacyWorkerAboutUnderReviewOrder()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    var worker = await SeedOrderAsync(db, workerTelegramId: 777_100_200L, status: Status.UnderReview);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, new ScriptedStaffTelegramBot());
    var enqueue = CreateEnqueue(provider);

    await enqueue.RunOnceAsync(CancellationToken.None);

    var message = await db.StaffTelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(worker.Id, message.PharmacyWorkerId);
    Assert.Equal(777_100_200L, message.ChatId);
    Assert.NotNull(message.OrderId);
    Assert.Contains("Новый заказ для сборки", message.Message, StringComparison.Ordinal);
    Assert.Contains("https://pharm.test/workspace#orders", message.Message, StringComparison.Ordinal);
  }

  [Fact]
  public async Task Enqueue_ShouldSkipWorkerWithoutTelegramId()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    await SeedOrderAsync(db, workerTelegramId: null, status: Status.UnderReview);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, new ScriptedStaffTelegramBot());
    var enqueue = CreateEnqueue(provider);

    await enqueue.RunOnceAsync(CancellationToken.None);

    Assert.Equal(0, await db.StaffTelegramOutboxMessages.CountAsync());
  }

  [Fact]
  public async Task Enqueue_ShouldNotifyWorkersAboutManualLookupRequest()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    var worker = await SeedManualLookupAsync(db, workerTelegramId: 777_300_400L);
    db.ChangeTracker.Clear();

    using var provider = BuildServiceProvider(db, new ScriptedStaffTelegramBot());
    var enqueue = CreateEnqueue(provider);

    await enqueue.RunOnceAsync(CancellationToken.None);

    var message = await db.StaffTelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(worker.Id, message.PharmacyWorkerId);
    Assert.Equal(777_300_400L, message.ChatId);
    Assert.NotNull(message.ManualLookupRequestId);
    Assert.Contains("Новый запрос фармацевта на поиск лекарства", message.Message, StringComparison.Ordinal);
    Assert.Contains("Амоксициллин", message.Message, StringComparison.Ordinal);
    Assert.Contains("https://pharm.test/workspace/lookups", message.Message, StringComparison.Ordinal);
  }

  [Fact]
  public async Task Dispatcher_ShouldSendStaffMessageAndMarkSent()
  {
    using var testScope = TestDbFactory.Create();
    var db = testScope.Db;
    var message = StaffTelegramOutboxMessage.CreateForManualLookup(
      manualLookupRequestId: Guid.NewGuid(),
      pharmacyWorkerId: Guid.NewGuid(),
      chatId: 777_500_600L,
      message: "staff message",
      nowUtc: DateTime.UtcNow.AddMinutes(-1));
    db.StaffTelegramOutboxMessages.Add(message);
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var bot = new ScriptedStaffTelegramBot();
    using var provider = BuildServiceProvider(db, bot);
    var dispatcher = new StaffTelegramOutboxDispatcherHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(CreateOptions()),
      NullLogger<StaffTelegramOutboxDispatcherHostedService>.Instance);

    await dispatcher.RunOnceAsync(CancellationToken.None);

    var saved = await db.StaffTelegramOutboxMessages.AsNoTracking().SingleAsync();
    Assert.Equal(TelegramOutboxState.Sent, saved.State);
    Assert.Single(bot.SentMessages);
    Assert.Equal(777_500_600L, bot.SentMessages[0].ChatId);
    Assert.Equal("staff message", bot.SentMessages[0].Text);
  }

  private static StaffTelegramNotificationEnqueueHostedService CreateEnqueue(ServiceProvider provider)
  {
    return new StaffTelegramNotificationEnqueueHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(CreateOptions()),
      Options.Create(new TelegramAuthOptions { WebhookPublicBaseUrl = "https://pharm.test" }),
      NullLogger<StaffTelegramNotificationEnqueueHostedService>.Instance);
  }

  private static StaffTelegramNotificationOptions CreateOptions()
  {
    return new StaffTelegramNotificationOptions
    {
      Enabled = true,
      BotToken = "test-token",
      BatchSize = 50,
      PollIntervalSeconds = 5,
      MaxAttempts = 5,
      RetryBackoffSeconds = 1,
      RetentionDays = 7,
      CatchUpMaxOrderAgeHours = 48,
      CatchUpMaxLookupAgeHours = 48
    };
  }

  private static ServiceProvider BuildServiceProvider(AppDbContext db, IStaffTelegramBotApi bot)
  {
    return new ServiceCollection()
      .AddLogging()
      .AddSingleton(db)
      .AddSingleton(bot)
      .BuildServiceProvider();
  }

  private static async Task<PharmacyWorker> SeedOrderAsync(AppDbContext db, long? workerTelegramId, Status status)
  {
    var client = TestDbFactory.CreateClient("Client", "900444000");
    var superAdmin = TestDbFactory.CreateUser("SA", "900444001", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", superAdmin.Id);
    var worker = TestDbFactory.CreateWorker("Admin", "900444002", pharmacy.Id, pharmacy);
    if (workerTelegramId.HasValue)
      worker.SetTelegramId(workerTelegramId.Value);

    var medicine = TestDbFactory.CreateMedicine("Med", $"ART-STAFF-{Guid.NewGuid():N}");

    db.Clients.Add(client);
    db.Users.Add(superAdmin);
    db.Pharmacies.Add(pharmacy);
    db.PharmacyWorkers.Add(worker);
    db.Medicines.Add(medicine);
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
    await db.SaveChangesAsync();

    if (status != Status.New)
    {
      await db.Database.ExecuteSqlInterpolatedAsync(
        $"UPDATE orders SET status = {(int)status} WHERE id = {orderId}");
    }

    return worker;
  }

  private static async Task<PharmacyWorker> SeedManualLookupAsync(AppDbContext db, long workerTelegramId)
  {
    var superAdmin = TestDbFactory.CreateUser("SA", "900555001", Role.SuperAdmin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", superAdmin.Id);
    var worker = TestDbFactory.CreateWorker("Admin", "900555002", pharmacy.Id, pharmacy);
    worker.SetTelegramId(workerTelegramId);
    var pharmacist = TestDbFactory.CreateUser("Pharmacist", "900555003", Role.Pharmacist);
    var client = TestDbFactory.CreateClient("Client", "900555004");
    var prescription = new Prescription(
      client.Id,
      patientAge: 35,
      clientComment: null,
      images: [new PrescriptionImage("rx-key", 0)],
      PrescriptionPreferenceTier.AsPrescribed);
    var request = new ManualItemLookupRequest(
      prescription.Id,
      pharmacist.Id,
      "Амоксициллин",
      "500 мг");

    db.Users.AddRange(superAdmin, pharmacist);
    db.Clients.Add(client);
    db.Pharmacies.Add(pharmacy);
    db.PharmacyWorkers.Add(worker);
    db.Prescriptions.Add(prescription);
    db.ManualItemLookupRequests.Add(request);
    await db.SaveChangesAsync();

    return worker;
  }

  private sealed class ScriptedStaffTelegramBot : IStaffTelegramBotApi
  {
    public List<(long ChatId, string Text)> SentMessages { get; } = new();

    public Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
    {
      SentMessages.Add((chatId, text));
      return Task.CompletedTask;
    }
  }
}
