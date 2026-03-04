using Microsoft.EntityFrameworkCore;
using Yalla.Domain.Entities;

namespace Yalla.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<PharmacyWorker> PharmacyWorkers { get; }
    DbSet<Pharmacy> Pharmacies { get; }
    DbSet<Medicine> Medicines { get; }
    DbSet<PharmacyOffer> PharmacyOffers { get; }
    DbSet<Order> Orders { get; }
    DbSet<PharmacyOrder> PharmacyOrders { get; }
    DbSet<Position> Positions { get; }
    DbSet<User> Users { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
