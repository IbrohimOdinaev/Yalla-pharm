using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Yalla.Domain.Entities;

namespace Yalla.Application.Abstractions;

public interface IAppDbContext
{
    DatabaseFacade Database { get; }
    DbSet<Client> Clients { get; }
    DbSet<PharmacyWorker> PharmacyWorkers { get; }
    DbSet<Pharmacist> Pharmacists { get; }
    DbSet<Prescription> Prescriptions { get; }
    DbSet<PrescriptionImage> PrescriptionImages { get; }
    DbSet<PrescriptionChecklistItem> PrescriptionChecklistItems { get; }
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
    DbSet<RefundRequestPosition> RefundRequestPositions { get; }
    DbSet<SmsVerificationSession> SmsVerificationSessions { get; }
    DbSet<SmsOutboxMessage> SmsOutboxMessages { get; }
    DbSet<TelegramOutboxMessage> TelegramOutboxMessages { get; }
    DbSet<TelegramAuthSession> TelegramAuthSessions { get; }
    DbSet<User> Users { get; }
    DbSet<Category> Categories { get; }
    DbSet<DeliveryData> DeliveryData { get; }
    DbSet<ClientAddress> ClientAddresses { get; }
    DbSet<PaymentSettings> PaymentSettings { get; }
    DbSet<SyncState> SyncStates { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
