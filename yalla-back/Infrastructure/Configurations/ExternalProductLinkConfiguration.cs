using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class ExternalProductLinkConfiguration : IEntityTypeConfiguration<ExternalProductLink>
{
  public void Configure(EntityTypeBuilder<ExternalProductLink> builder)
  {
    builder.ToTable("external_product_links");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.SourceId)
      .HasColumnName("source_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.SourceType)
      .HasColumnName("source_type")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.ExternalProductId)
      .HasColumnName("external_product_id")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.ExternalBarcode)
      .HasColumnName("external_barcode")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired(false);

    builder.Property(x => x.ExternalTitle)
      .HasColumnName("external_title")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512)
      .IsRequired(false);

    builder.Property(x => x.MedicineId)
      .HasColumnName("medicine_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.MatchStatus)
      .HasColumnName("match_status")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.MatchMethod)
      .HasColumnName("match_method")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.Confidence)
      .HasColumnName("confidence")
      .HasColumnType("numeric(5,4)")
      .HasPrecision(5, 4)
      .IsRequired(false);

    builder.Property(x => x.FirstSeenAtUtc)
      .HasColumnName("first_seen_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.LastSeenAtUtc)
      .HasColumnName("last_seen_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasIndex(x => new { x.SourceId, x.ExternalProductId })
      .IsUnique()
      .HasDatabaseName("ux_external_product_links_source_id_external_product_id");

    builder.HasIndex(x => new { x.PharmacyId, x.SourceType, x.ExternalProductId })
      .HasDatabaseName("ix_external_product_links_pharmacy_source_external_id");

    builder.HasIndex(x => x.ExternalBarcode)
      .HasDatabaseName("ix_external_product_links_external_barcode");

    builder.HasIndex(x => x.MedicineId)
      .HasDatabaseName("ix_external_product_links_medicine_id")
      .HasFilter("medicine_id IS NOT NULL");

    builder.HasOne<IntegrationSource>()
      .WithMany()
      .HasForeignKey(x => x.SourceId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Medicine>()
      .WithMany()
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.SetNull)
      .IsRequired(false);
  }
}
