using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class RefundRequestPositionConfiguration : IEntityTypeConfiguration<RefundRequestPosition>
{
  public void Configure(EntityTypeBuilder<RefundRequestPosition> builder)
  {
    builder.ToTable("refund_request_positions");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.RefundRequestId)
      .HasColumnName("refund_request_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.OrderPositionId)
      .HasColumnName("order_position_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.MedicineId)
      .HasColumnName("medicine_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.MedicineName)
      .HasColumnName("medicine_name")
      .HasColumnType("character varying(256)")
      .HasMaxLength(256)
      .IsRequired();

    builder.Property(x => x.Quantity)
      .HasColumnName("quantity")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.UnitPrice)
      .HasColumnName("unit_price")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .IsRequired();

    builder.Property(x => x.LineTotal)
      .HasColumnName("line_total")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .IsRequired();

    builder.HasIndex(x => x.RefundRequestId)
      .HasDatabaseName("ix_refund_request_positions_refund_request_id");
  }
}
