using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
  public void Configure(EntityTypeBuilder<Order> builder)
  {
    builder.ToTable("orders");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.ClientId)
      .HasColumnName("client_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.DeliveryAddress)
      .HasColumnName("delivery_address")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.Cost)
      .HasColumnName("cost")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .HasDefaultValue(0m)
      .IsRequired();

    builder.Property(x => x.ReturnCost)
      .HasColumnName("return_cost")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .HasDefaultValue(0m)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(Status.New)
      .IsRequired();

    builder.HasIndex(x => x.ClientId)
      .HasDatabaseName("ix_orders_client_id");

    builder.HasIndex(x => x.Status)
      .HasDatabaseName("ix_orders_status");

    builder.HasMany(x => x.Positions)
      .WithOne()
      .HasForeignKey(y => y.OrderId)
      .IsRequired(false);

    builder.HasMany(x => x.PharmacyOrders)
      .WithOne()
      .HasForeignKey(y => y.OrderId);

    builder.HasMany(x => x.RejectedPositions)
      .WithMany()
      .UsingEntity<OrderRejectedPosition>(
        right => right
          .HasOne<Position>()
          .WithMany()
          .HasForeignKey(x => x.PositionId)
          .OnDelete(DeleteBehavior.Cascade)
          .HasConstraintName("fk_order_rejected_positions_position_id"),
        left => left
          .HasOne<Order>()
          .WithMany()
          .HasForeignKey(x => x.OrderId)
          .OnDelete(DeleteBehavior.Cascade)
          .HasConstraintName("fk_order_rejected_positions_order_id"));

    builder.Metadata.FindNavigation(nameof(Order.Positions))?.SetField("_positions");
    builder.Metadata.FindNavigation(nameof(Order.Positions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    builder.Metadata.FindNavigation(nameof(Order.RejectedPositions))?.SetField("_rejectedPositions");
    builder.Metadata.FindNavigation(nameof(Order.RejectedPositions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    builder.Metadata.FindNavigation(nameof(Order.PharmacyOrders))?.SetField("_pharmacyOrders");
    builder.Metadata.FindNavigation(nameof(Order.PharmacyOrders))?.SetPropertyAccessMode(PropertyAccessMode.Field);
  }
}
