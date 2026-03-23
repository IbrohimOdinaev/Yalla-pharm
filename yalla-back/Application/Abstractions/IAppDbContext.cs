using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Yalla.Domain.Entities;

namespace Yalla.Application.Abstractions;

public interface IAppDbContext
{
    DatabaseFacade Database { get; }
    DbSet<Client> Clients { get; }
    DbSet<PharmacyWorker> PharmacyWorkers { get; }
    DbSet<Pharmacy> Pharmacies { get; }
    DbSet<Medicine> Medicines { get; }
    DbSet<MedicineImage> MedicineImages { get; }
    DbSet<Offer> Offers { get; }
    DbSet<Order> Orders { get; }
    DbSet<BasketPosition> BasketPositions { get; }
    DbSet<OrderPosition> OrderPositions { get; }
    DbSet<PaymentHistory> PaymentHistories { get; }
    DbSet<PaymentIntent> PaymentIntents { get; }
    DbSet<PaymentIntentPosition> PaymentIntentPositions { get; }
    DbSet<CheckoutRequest> CheckoutRequests { get; }
    DbSet<RefundRequest> RefundRequests { get; }
    DbSet<SmsVerificationSession> SmsVerificationSessions { get; }
    DbSet<SmsOutboxMessage> SmsOutboxMessages { get; }
    DbSet<User> Users { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
