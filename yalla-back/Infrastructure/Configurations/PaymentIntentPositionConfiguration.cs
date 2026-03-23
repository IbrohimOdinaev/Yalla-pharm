using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class PaymentIntentPositionConfiguration : IEntityTypeConfiguration<PaymentIntentPosition>
{
  public void Configure(EntityTypeBuilder<PaymentIntentPosition> builder)
  {
    builder.ToTable("payment_intent_positions");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.PaymentIntentId)
      .HasColumnName("payment_intent_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.MedicineId)
      .HasColumnName("medicine_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.OfferPharmacyId)
      .HasColumnName("offer_pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.OfferPrice)
      .HasColumnName("offer_price")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .IsRequired();

    builder.Property(x => x.Quantity)
      .HasColumnName("quantity")
      .HasColumnType("integer")
      .IsRequired();

    builder.HasIndex(x => x.PaymentIntentId)
      .HasDatabaseName("ix_payment_intent_positions_payment_intent_id");

    builder.HasIndex(x => x.MedicineId)
      .HasDatabaseName("ix_payment_intent_positions_medicine_id");

    builder.HasOne<Medicine>()
      .WithMany()
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.OfferPharmacyId)
      .OnDelete(DeleteBehavior.Restrict);
  }
}
