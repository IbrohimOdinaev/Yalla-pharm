using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class DeliveryDataConfiguration : IEntityTypeConfiguration<DeliveryData>
{
  public void Configure(EntityTypeBuilder<DeliveryData> builder)
  {
    builder.ToTable("delivery_data");

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

    // From address (pharmacy)
    builder.Property(x => x.FromAddressId)
      .HasColumnName("from_address_id")
      .HasColumnType("bigint");

    builder.Property(x => x.FromTitle)
      .HasColumnName("from_title")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.FromAddress)
      .HasColumnName("from_address")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.FromLatitude)
      .HasColumnName("from_latitude")
      .HasColumnType("double precision")
      .IsRequired();

    builder.Property(x => x.FromLongitude)
      .HasColumnName("from_longitude")
      .HasColumnType("double precision")
      .IsRequired();

    // To address (client)
    builder.Property(x => x.ToAddressId)
      .HasColumnName("to_address_id")
      .HasColumnType("bigint");

    builder.Property(x => x.ToTitle)
      .HasColumnName("to_title")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.ToAddress)
      .HasColumnName("to_address")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.ToLatitude)
      .HasColumnName("to_latitude")
      .HasColumnType("double precision")
      .IsRequired();

    builder.Property(x => x.ToLongitude)
      .HasColumnName("to_longitude")
      .HasColumnType("double precision")
      .IsRequired();

    // Delivery cost
    builder.Property(x => x.DeliveryCost)
      .HasColumnName("delivery_cost")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .HasDefaultValue(0m)
      .IsRequired();

    builder.Property(x => x.Distance)
      .HasColumnName("distance")
      .HasColumnType("double precision");

    // JURA order
    builder.Property(x => x.JuraOrderId)
      .HasColumnName("jura_order_id")
      .HasColumnType("bigint");

    builder.Property(x => x.JuraStatus)
      .HasColumnName("jura_status")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64);

    builder.Property(x => x.JuraStatusId)
      .HasColumnName("jura_status_id")
      .HasColumnType("integer");

    builder.Property(x => x.DriverDeviceId)
      .HasColumnName("driver_device_id")
      .HasColumnType("bigint");

    builder.Property(x => x.DriverName)
      .HasColumnName("driver_name")
      .HasColumnType("character varying(200)")
      .HasMaxLength(200);

    builder.Property(x => x.DriverPhone)
      .HasColumnName("driver_phone")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20);

    // Indexes
    builder.HasIndex(x => x.OrderId)
      .IsUnique()
      .HasDatabaseName("ux_delivery_data_order_id");

    builder.HasIndex(x => x.JuraOrderId)
      .HasDatabaseName("ix_delivery_data_jura_order_id");

    // Relationship configured from Order side
  }
}
