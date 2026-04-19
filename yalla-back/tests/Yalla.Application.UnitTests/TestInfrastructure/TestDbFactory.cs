using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Services;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;
using Yalla.Infrastructure;

namespace Yalla.Application.UnitTests.TestInfrastructure;

internal sealed class FakePaymentSettingsService : IPaymentSettingsService
{
  private readonly string? _baseUrl;
  public FakePaymentSettingsService(string? baseUrl = null) => _baseUrl = baseUrl;
  public Task<string?> GetDcBaseUrlAsync(CancellationToken ct = default) => Task.FromResult(_baseUrl);
  public Task SetDcBaseUrlAsync(string? url, Guid updatedByUserId, CancellationToken ct = default) => Task.CompletedTask;
  public Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken ct = default)
    => Task.FromResult(new PaymentSettingsSnapshot { DcBaseUrl = _baseUrl, DcBaseUrlEffective = _baseUrl ?? string.Empty });
}

internal sealed class FakeClientAddressService : IClientAddressService
{
  public Task<IReadOnlyCollection<Yalla.Application.DTO.Response.ClientAddressResponse>> GetAllAsync(Guid clientId, CancellationToken ct = default)
    => Task.FromResult<IReadOnlyCollection<Yalla.Application.DTO.Response.ClientAddressResponse>>(Array.Empty<Yalla.Application.DTO.Response.ClientAddressResponse>());
  public Task<Yalla.Application.DTO.Response.ClientAddressResponse> UpsertAsync(Guid clientId, Yalla.Application.DTO.Request.UpsertClientAddressRequest request, CancellationToken ct = default)
    => throw new NotSupportedException("Fake — not used by tests that hit this.");
  public Task<Yalla.Application.DTO.Response.ClientAddressResponse> UpdateAsync(Guid clientId, Guid addressId, Yalla.Application.DTO.Request.UpdateClientAddressRequest request, CancellationToken ct = default)
    => throw new NotSupportedException("Fake — not used by tests that hit this.");
  public Task DeleteAsync(Guid clientId, Guid addressId, CancellationToken ct = default) => Task.CompletedTask;
  public Task RecordUsageAsync(Guid clientId, string address, double latitude, double longitude, CancellationToken ct = default) => Task.CompletedTask;
}

internal static class TestDbFactory
{
  public static TestDbScope Create()
  {
    var connection = new SqliteConnection("Data Source=:memory:");
    connection.Open();

    var options = new DbContextOptionsBuilder<AppDbContext>()
      .UseSqlite(connection)
      .EnableSensitiveDataLogging()
      .Options;

    var db = new AppDbContext(options);
    db.Database.EnsureCreated();

    return new TestDbScope(db, connection);
  }

  public static User CreateUser(string name, string phone, Role role)
  {
    return new User(Guid.NewGuid(), name, phone, "test-hash", role);
  }

  public static Client CreateClient(string name, string phone)
  {
    return new Client(name, phone, "test-hash");
  }

  public static Pharmacy CreatePharmacy(string title, string address, Guid adminId, bool isActive = true)
  {
    var pharmacy = new Pharmacy(title, address);
    pharmacy.SetAdminId(adminId);
    if (!isActive)
      pharmacy.ChangeActivity();

    return pharmacy;
  }

  public static PharmacyWorker CreateWorker(
    string name,
    string phone,
    Guid pharmacyId,
    Pharmacy pharmacy)
  {
    return new PharmacyWorker(name, phone, "test-hash", pharmacyId, pharmacy);
  }

  public static Medicine CreateMedicine(
    string title,
    string articul,
    bool isActive = true)
  {
    var medicine = new Medicine(
      title,
      articul,
      [new Atribute(AttributeType.Dosage, "500mg")]);

    if (!isActive)
      medicine.SetIsActive(false);

    return medicine;
  }

  public static Offer CreateOffer(Guid medicineId, Guid pharmacyId, int stock, decimal price)
  {
    return new Offer(medicineId, pharmacyId, stock, price);
  }

  public static Order CreateOrder(
    Guid clientId,
    Guid pharmacyId,
    string address,
    params (Medicine medicine, decimal price, int quantity, bool isRejected)[] positions)
  {
    return CreateOrder(clientId, pharmacyId, address, isPickup: false, positions);
  }

  public static Order CreateOrder(
    Guid clientId,
    Guid pharmacyId,
    string address,
    bool isPickup,
    params (Medicine medicine, decimal price, int quantity, bool isRejected)[] positions)
  {
    var orderId = Guid.NewGuid();
    var orderPositions = positions
      .Select(x => new OrderPosition(
        orderId: orderId,
        medicineId: x.medicine.Id,
        medicine: x.medicine,
        offerSnapshot: new OfferSnapshot(pharmacyId, x.price),
        quantity: x.quantity,
        isRejected: x.isRejected))
      .ToList();

    return new Order(orderId, clientId, "900000000", pharmacyId, address, orderPositions, isPickup: isPickup);
  }
}

internal sealed class TestDbScope : IDisposable
{
  public AppDbContext Db { get; }
  private readonly SqliteConnection _connection;

  public TestDbScope(AppDbContext db, SqliteConnection connection)
  {
    Db = db;
    _connection = connection;
  }

  public void Dispose()
  {
    Db.Dispose();
    _connection.Dispose();
  }
}

internal sealed class TestMedicineImageStorage : IMedicineImageStorage
{
  public readonly HashSet<string> UploadedKeys = [];
  private readonly Dictionary<string, byte[]> _storage = new(StringComparer.Ordinal);

  public Task<string> UploadAsync(
    Stream content,
    string contentType,
    string fileName,
    CancellationToken cancellationToken = default)
  {
    var key = $"test/{Guid.NewGuid():N}";
    UploadedKeys.Add(key);
    using var memory = new MemoryStream();
    content.CopyTo(memory);
    _storage[key] = memory.ToArray();
    return Task.FromResult(key);
  }

  public Task<MedicineImageContent> GetContentAsync(string key, CancellationToken cancellationToken = default)
  {
    var bytes = _storage.TryGetValue(key, out var value) ? value : [];
    return Task.FromResult(new MedicineImageContent
    {
      Content = new MemoryStream(bytes, writable: false),
      ContentType = "image/png"
    });
  }

  public Task<string> GetUrlAsync(string key, CancellationToken cancellationToken = default)
  {
    return Task.FromResult($"/test-images/{key}");
  }

  public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
  {
    UploadedKeys.Remove(key);
    _storage.Remove(key);
    return Task.CompletedTask;
  }
}
