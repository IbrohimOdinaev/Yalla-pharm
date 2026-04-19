using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class OrderPositionConfiguration : IEntityTypeConfiguration<OrderPosition>
{
    public void Configure(EntityTypeBuilder<OrderPosition> builder)
    {
        builder.ToTable("order_positions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedOnAdd()
          .IsRequired();

        builder.Property(x => x.OrderId)
          .HasColumnName("order_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.MedicineId)
          .HasColumnName("medicine_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.Quantity)
          .HasColumnName("quantity")
          .HasColumnType("integer")
          .HasDefaultValue(1)
          .IsRequired();

        builder.Property(x => x.IsRejected)
          .HasColumnName("is_rejected")
          .HasColumnType("boolean")
          .HasDefaultValue(false)
          .IsRequired();

        builder.Property(x => x.ReturnedQuantity)
          .HasColumnName("returned_quantity")
          .HasColumnType("integer")
          .HasDefaultValue(0)
          .IsRequired();

        builder.HasIndex(x => x.OrderId)
          .HasDatabaseName("ix_order_positions_order_id");

        builder.HasIndex(x => x.MedicineId)
          .HasDatabaseName("ix_order_positions_medicine_id");

        builder.HasOne(x => x.Medicine)
          .WithMany()
          .HasForeignKey(x => x.MedicineId)
          .OnDelete(DeleteBehavior.Restrict);

        builder.OwnsOne(x => x.OfferSnapshot, offer =>
        {
            offer.WithOwner();

            offer.Property(x => x.PharmacyId)
              .HasColumnName("offer_pharmacy_id")
              .HasColumnType("uuid")
              .IsRequired();

            offer.Property(x => x.Price)
              .HasColumnName("offer_price")
              .HasColumnType("numeric(18,2)")
              .HasPrecision(18, 2)
              .IsRequired();
        });

        builder.Navigation(x => x.OfferSnapshot)
          .IsRequired();
    }
}
