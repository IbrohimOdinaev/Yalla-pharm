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
  public DbSet<PharmacyOffer> PharmacyOffers => Set<PharmacyOffer>();
  public DbSet<Order> Orders => Set<Order>();
  public DbSet<Pharmacy> Pharmacies => Set<Pharmacy>();
  public DbSet<PharmacyOrder> PharmacyOrders => Set<PharmacyOrder>();
  public DbSet<PharmacyWorker> PharmacyWorkers => Set<PharmacyWorker>();
  public DbSet<Position> Positions => Set<Position>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    base.OnModelCreating(modelBuilder);
  }
}
