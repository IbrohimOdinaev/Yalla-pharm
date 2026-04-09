using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Yalla.Application.Abstractions;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure;

public class AppDbContext : DbContext, IAppDbContext
{
  public AppDbContext(DbContextOptions<AppDbContext> options)
    : base(options) { }

  public DbSet<User> Users => Set<User>();
  public DbSet<Client> Clients => Set<Client>();
  public DbSet<Medicine> Medicines => Set<Medicine>();
  public DbSet<MedicineImage> MedicineImages => Set<MedicineImage>();
  public DbSet<Offer> Offers => Set<Offer>();
  public DbSet<Order> Orders => Set<Order>();
  public DbSet<Pharmacy> Pharmacies => Set<Pharmacy>();
  public DbSet<PharmacyWorker> PharmacyWorkers => Set<PharmacyWorker>();
  public DbSet<BasketPosition> BasketPositions => Set<BasketPosition>();
  public DbSet<OrderPosition> OrderPositions => Set<OrderPosition>();
  public DbSet<PaymentHistory> PaymentHistories => Set<PaymentHistory>();
  public DbSet<PaymentIntent> PaymentIntents => Set<PaymentIntent>();
  public DbSet<PaymentIntentPosition> PaymentIntentPositions => Set<PaymentIntentPosition>();
  public DbSet<CheckoutRequest> CheckoutRequests => Set<CheckoutRequest>();
  public DbSet<RefundRequest> RefundRequests => Set<RefundRequest>();
  public DbSet<SmsVerificationSession> SmsVerificationSessions => Set<SmsVerificationSession>();
  public DbSet<SmsOutboxMessage> SmsOutboxMessages => Set<SmsOutboxMessage>();
  public DbSet<Category> Categories => Set<Category>();
  public DbSet<DeliveryData> DeliveryData => Set<DeliveryData>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    ApplyUtcDateTimeConverters(modelBuilder);

    base.OnModelCreating(modelBuilder);
  }

  private static void ApplyUtcDateTimeConverters(ModelBuilder modelBuilder)
  {
    var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
      toProvider => toProvider.Kind == DateTimeKind.Unspecified
        ? toProvider
        : DateTime.SpecifyKind(toProvider, DateTimeKind.Unspecified),
      fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
      toProvider => toProvider.HasValue
        ? (toProvider.Value.Kind == DateTimeKind.Unspecified
          ? toProvider
          : DateTime.SpecifyKind(toProvider.Value, DateTimeKind.Unspecified))
        : null,
      fromProvider => fromProvider.HasValue
        ? DateTime.SpecifyKind(fromProvider.Value, DateTimeKind.Utc)
        : null);

    foreach (var entityType in modelBuilder.Model.GetEntityTypes())
    {
      foreach (var property in entityType.GetProperties())
      {
        if (property.ClrType == typeof(DateTime))
        {
          property.SetValueConverter(dateTimeConverter);
          continue;
        }

        if (property.ClrType == typeof(DateTime?))
          property.SetValueConverter(nullableDateTimeConverter);
      }
    }
  }
}
