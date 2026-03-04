using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PharmacyOrderConfiguration : IEntityTypeConfiguration<PharmacyOrder>
{
    public void Configure(EntityTypeBuilder<PharmacyOrder> builder)
    {
        builder.ToTable("pharmacy_orders");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedOnAdd()
          .IsRequired();

        builder.Property(x => x.PharmacyId)
          .HasColumnName("pharmacy_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.OrderId)
          .HasColumnName("order_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.HasIndex(x => x.OrderId)
          .HasDatabaseName("ix_pharmacy_orders_order_id");

        builder.HasIndex(x => x.PharmacyId)
          .HasDatabaseName("ix_pharmacy_orders_pharmacy_id");

        builder.HasOne<Pharmacy>()
          .WithMany()
          .HasForeignKey(x => x.PharmacyId)
          .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Positions)
          .WithMany()
          .UsingEntity<PharmacyOrderPosition>(
            right => right
              .HasOne<Position>()
              .WithMany()
              .HasForeignKey(x => x.PositionId)
              .OnDelete(DeleteBehavior.Cascade)
              .HasConstraintName("fk_pharmacy_order_positions_position_id"),
            left => left
              .HasOne<PharmacyOrder>()
              .WithMany()
              .HasForeignKey(x => x.PharmacyOrderId)
              .OnDelete(DeleteBehavior.Cascade)
              .HasConstraintName("fk_pharmacy_order_positions_pharmacy_order_id"));

        builder.HasMany(x => x.RejectedPositions)
          .WithMany()
          .UsingEntity<PharmacyOrderRejectedPosition>(
            right => right
              .HasOne<Position>()
              .WithMany()
              .HasForeignKey(x => x.PositionId)
              .OnDelete(DeleteBehavior.Cascade)
              .HasConstraintName("fk_pharmacy_order_rejected_positions_position_id"),
            left => left
              .HasOne<PharmacyOrder>()
              .WithMany()
              .HasForeignKey(x => x.PharmacyOrderId)
              .OnDelete(DeleteBehavior.Cascade)
              .HasConstraintName("fk_pharmacy_order_rejected_positions_pharmacy_order_id"));

        builder.Metadata.FindNavigation(nameof(PharmacyOrder.Positions))?.SetField("_positions");
        builder.Metadata.FindNavigation(nameof(PharmacyOrder.Positions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(PharmacyOrder.RejectedPositions))?.SetField("_rejectedPositions");
        builder.Metadata.FindNavigation(nameof(PharmacyOrder.RejectedPositions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
