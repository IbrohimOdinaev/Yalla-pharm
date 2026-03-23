using Microsoft.EntityFrameworkCore;
using Yalla.Application.Services;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests.TestInfrastructure;

public enum TestActor
{
  SuperAdmin,
  Admin1,
  Admin2,
  Client1,
  Client2
}

public static class ApiTestData
{
  public static readonly Guid SuperAdminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
  public static readonly Guid Admin1Id = Guid.Parse("22222222-2222-2222-2222-222222222222");
  public static readonly Guid Admin2Id = Guid.Parse("33333333-3333-3333-3333-333333333333");
  public static readonly Guid WorkerInPharmacy1Id = Guid.Parse("22222222-2222-2222-2222-222222222299");
  public static readonly Guid WorkerInPharmacy2Id = Guid.Parse("33333333-3333-3333-3333-333333333399");
  public static readonly Guid Client1Id = Guid.Parse("44444444-4444-4444-4444-444444444444");
  public static readonly Guid Client2Id = Guid.Parse("55555555-5555-5555-5555-555555555555");

  public static readonly Guid Pharmacy1Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
  public static readonly Guid Pharmacy2Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2");

  public static readonly Guid Medicine1Id = Guid.Parse("cccccccc-cccc-cccc-cccc-ccccccccccc1");
  public static readonly Guid Medicine2Id = Guid.Parse("dddddddd-dddd-dddd-dddd-ddddddddddd2");

  public static readonly Guid BasketPosition1Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1");

  public static readonly Guid OrderUnderReviewId = Guid.Parse("90000000-0000-0000-0000-000000000001");
  public static readonly Guid OrderPreparingId = Guid.Parse("90000000-0000-0000-0000-000000000002");
  public static readonly Guid OrderReadyId = Guid.Parse("90000000-0000-0000-0000-000000000003");
  public static readonly Guid OrderOnTheWayId = Guid.Parse("90000000-0000-0000-0000-000000000004");
  public static readonly Guid OrderCancelableId = Guid.Parse("90000000-0000-0000-0000-000000000005");
  public static readonly Guid OrderPharmacy2Id = Guid.Parse("90000000-0000-0000-0000-000000000006");

  public static readonly Guid OrderPositionUnderReviewId = Guid.Parse("91000000-0000-0000-0000-000000000001");
  public static readonly Guid OrderPositionPreparingId = Guid.Parse("91000000-0000-0000-0000-000000000002");
  public static readonly Guid OrderPositionReadyId = Guid.Parse("91000000-0000-0000-0000-000000000003");
  public static readonly Guid OrderPositionOnTheWayId = Guid.Parse("91000000-0000-0000-0000-000000000004");
  public static readonly Guid OrderPositionCancelableId = Guid.Parse("91000000-0000-0000-0000-000000000005");
  public static readonly Guid OrderPositionPharmacy2Id = Guid.Parse("91000000-0000-0000-0000-000000000006");

  public const string DefaultPassword = "Pass123!";
  public const string SuperAdminPhone = "900000001";
  public const string Admin1Phone = "900000002";
  public const string Admin2Phone = "900000003";
  public const string WorkerPharmacy1Phone = "900000012";
  public const string WorkerPharmacy2Phone = "900000013";
  public const string Client1Phone = "900000004";
  public const string Client2Phone = "900000005";

  public static (string Phone, string Password) GetCredentials(TestActor actor)
  {
    return actor switch
    {
      TestActor.SuperAdmin => (SuperAdminPhone, DefaultPassword),
      TestActor.Admin1 => (Admin1Phone, DefaultPassword),
      TestActor.Admin2 => (Admin2Phone, DefaultPassword),
      TestActor.Client1 => (Client1Phone, DefaultPassword),
      TestActor.Client2 => (Client2Phone, DefaultPassword),
      _ => throw new ArgumentOutOfRangeException(nameof(actor), actor, null)
    };
  }

  public static async Task SeedAsync(AppDbContext dbContext)
  {
    var hasher = new BCryptPasswordHasher();
    var passwordHash = hasher.HashPassword(DefaultPassword);

    var superAdmin = new User(
      SuperAdminId,
      "Super Admin",
      SuperAdminPhone,
      passwordHash,
      Role.SuperAdmin);

    var pharmacy1 = new Pharmacy(
      Pharmacy1Id,
      "Pharmacy One",
      "Dushanbe, Rudaki 1",
      Admin1Id,
      true);

    var pharmacy2 = new Pharmacy(
      Pharmacy2Id,
      "Pharmacy Two",
      "Dushanbe, Somoni 5",
      Admin2Id,
      true);

    var admin1 = new PharmacyWorker(
      Admin1Id,
      "Admin One",
      Admin1Phone,
      passwordHash,
      Pharmacy1Id,
      pharmacy1,
      Role.Admin);

    var admin2 = new PharmacyWorker(
      Admin2Id,
      "Admin Two",
      Admin2Phone,
      passwordHash,
      Pharmacy2Id,
      pharmacy2,
      Role.Admin);

    var workerInPharmacy1 = new PharmacyWorker(
      WorkerInPharmacy1Id,
      "Worker One",
      WorkerPharmacy1Phone,
      passwordHash,
      Pharmacy1Id,
      pharmacy1,
      Role.Admin);

    var workerInPharmacy2 = new PharmacyWorker(
      WorkerInPharmacy2Id,
      "Worker Two",
      WorkerPharmacy2Phone,
      passwordHash,
      Pharmacy2Id,
      pharmacy2,
      Role.Admin);

    var client1 = new Client(
      Client1Id,
      "Client One",
      Client1Phone,
      passwordHash,
      Role.Client,
      []);

    var client2 = new Client(
      Client2Id,
      "Client Two",
      Client2Phone,
      passwordHash,
      Role.Client,
      []);

    var medicine1 = new Medicine(
      Medicine1Id,
      "Paracetamol",
      "ART-001",
      [new Atribute("dosage", "500mg")],
      [],
      [],
      true);

    var medicine2 = new Medicine(
      Medicine2Id,
      "Vitamin C",
      "ART-002",
      [new Atribute("form", "tablet")],
      [],
      [],
      false);

    var offer1 = new Offer(Guid.Parse("60000000-0000-0000-0000-000000000001"), Medicine1Id, Pharmacy1Id, 100, 10m);
    var offer2 = new Offer(Guid.Parse("60000000-0000-0000-0000-000000000002"), Medicine1Id, Pharmacy2Id, 50, 12m);
    var offer3 = new Offer(Guid.Parse("60000000-0000-0000-0000-000000000003"), Medicine2Id, Pharmacy1Id, 20, 5m);

    var basketPosition1 = new BasketPosition(
      BasketPosition1Id,
      Client1Id,
      Medicine1Id,
      medicine1,
      2);

    var orderUnderReview = CreateOrder(
      OrderUnderReviewId,
      OrderPositionUnderReviewId,
      Client1Id,
      client1.PhoneNumber,
      Pharmacy1Id,
      medicine1,
      1,
      10m,
      1);

    var orderPreparing = CreateOrder(
      OrderPreparingId,
      OrderPositionPreparingId,
      Client1Id,
      client1.PhoneNumber,
      Pharmacy1Id,
      medicine1,
      2,
      10m,
      2);

    var orderReady = CreateOrder(
      OrderReadyId,
      OrderPositionReadyId,
      Client1Id,
      client1.PhoneNumber,
      Pharmacy1Id,
      medicine1,
      1,
      10m,
      3);

    var orderOnTheWay = CreateOrder(
      OrderOnTheWayId,
      OrderPositionOnTheWayId,
      Client1Id,
      client1.PhoneNumber,
      Pharmacy1Id,
      medicine1,
      1,
      10m,
      4);

    var orderCancelable = CreateOrder(
      OrderCancelableId,
      OrderPositionCancelableId,
      Client1Id,
      client1.PhoneNumber,
      Pharmacy1Id,
      medicine1,
      1,
      10m,
      3);

    var orderPharmacy2 = CreateOrder(
      OrderPharmacy2Id,
      OrderPositionPharmacy2Id,
      Client2Id,
      client2.PhoneNumber,
      Pharmacy2Id,
      medicine1,
      1,
      12m,
      1);

    var refundRequest = new RefundRequest(
      OrderOnTheWayId,
      Client1Id,
      Pharmacy1Id,
      10m,
      "TJS",
      "seed-trx-1",
      "Seed manual refund request.");

    dbContext.Users.Add(superAdmin);
    dbContext.Pharmacies.AddRange(pharmacy1, pharmacy2);
    dbContext.PharmacyWorkers.AddRange(admin1, admin2, workerInPharmacy1, workerInPharmacy2);
    dbContext.Clients.AddRange(client1, client2);
    dbContext.Medicines.AddRange(medicine1, medicine2);
    dbContext.Offers.AddRange(offer1, offer2, offer3);
    dbContext.BasketPositions.Add(basketPosition1);
    dbContext.Orders.AddRange(
      orderUnderReview,
      orderPreparing,
      orderReady,
      orderOnTheWay,
      orderCancelable,
      orderPharmacy2);
    dbContext.RefundRequests.Add(refundRequest);

    await dbContext.SaveChangesAsync();
  }

  private static Order CreateOrder(
    Guid orderId,
    Guid positionId,
    Guid clientId,
    string clientPhoneNumber,
    Guid pharmacyId,
    Medicine medicine,
    int quantity,
    decimal price,
    int stageTransitions)
  {
    var position = new OrderPosition(
      positionId,
      orderId,
      medicine.Id,
      medicine,
      new OfferSnapshot(pharmacyId, price),
      quantity);

    var order = new Order(
      orderId,
      clientId,
      clientPhoneNumber,
      pharmacyId,
      "Seed delivery address",
      [position],
      $"seed-{orderId:N}");

    for (var i = 0; i < stageTransitions; i++)
      order.NextStage(true);

    return order;
  }
}
