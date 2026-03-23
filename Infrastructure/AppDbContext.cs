using Microsoft.EntityFrameworkCore;
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
  public DbSet<CheckoutRequest> CheckoutRequests => Set<CheckoutRequest>();
  public DbSet<RefundRequest> RefundRequests => Set<RefundRequest>();
  public DbSet<SmsVerificationSession> SmsVerificationSessions => Set<SmsVerificationSession>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    base.OnModelCreating(modelBuilder);
  }
}
