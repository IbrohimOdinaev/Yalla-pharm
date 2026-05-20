using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class MedicineBarcodeConfiguration : IEntityTypeConfiguration<MedicineBarcode>
{
  public void Configure(EntityTypeBuilder<MedicineBarcode> builder)
  {
    builder.ToTable("medicine_barcodes");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.MedicineId)
      .HasColumnName("medicine_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.Barcode)
      .HasColumnName("barcode")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.IsVerified)
      .HasColumnName("is_verified")
      .HasColumnType("boolean")
      .HasDefaultValue(false)
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.LastSeenAtUtc)
      .HasColumnName("last_seen_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasIndex(x => x.Barcode)
      .HasDatabaseName("ix_medicine_barcodes_barcode");

    builder.HasIndex(x => new { x.MedicineId, x.Barcode })
      .IsUnique()
      .HasDatabaseName("ux_medicine_barcodes_medicine_id_barcode");

    builder.HasOne<Medicine>()
      .WithMany()
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.Cascade);
  }
}
