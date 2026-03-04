using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.ToTable("positions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedOnAdd()
          .IsRequired();

        builder.Property(x => x.OrderId)
          .HasColumnName("order_id")
          .HasColumnType("uuid");

        builder.Property(x => x.ClientId)
          .HasColumnName("client_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property<Guid?>("basket_client_id")
          .HasColumnName("basket_client_id")
          .HasColumnType("uuid");

        builder.Property(x => x.MedicineId)
          .HasColumnName("medicine_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.Quantity)
          .HasColumnName("quantity")
          .HasColumnType("integer")
          .HasDefaultValue(1)
          .IsRequired();

        builder.HasIndex(x => x.OrderId)
          .HasDatabaseName("ix_positions_order_id");

        builder.HasIndex(x => x.MedicineId)
          .HasDatabaseName("ix_positions_medicine_id");

        builder.HasIndex("basket_client_id")
          .HasDatabaseName("ix_positions_basket_client_id");

        builder.HasOne(x => x.Medicine)
          .WithMany()
          .HasForeignKey(x => x.MedicineId)
          .OnDelete(DeleteBehavior.Restrict);

        builder.OwnsOne(x => x.CapturedOffer, offer =>
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

        builder.Navigation(x => x.CapturedOffer)
          .IsRequired();
    }
}
