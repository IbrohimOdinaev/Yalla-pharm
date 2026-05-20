using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class IntegrationSourceConfiguration : IEntityTypeConfiguration<IntegrationSource>
{
  public void Configure(EntityTypeBuilder<IntegrationSource> builder)
  {
    builder.ToTable("integration_sources");

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

    builder.Property(x => x.Type)
      .HasColumnName("type")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.Token)
      .HasColumnName("token")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.Name)
      .HasColumnName("name")
      .HasColumnType("character varying(256)")
      .HasMaxLength(256)
      .IsRequired();

    builder.Property(x => x.IsActive)
      .HasColumnName("is_active")
      .HasColumnType("boolean")
      .HasDefaultValue(true)
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasIndex(x => x.Token)
      .IsUnique()
      .HasDatabaseName("ux_integration_sources_token");

    builder.HasIndex(x => new { x.PharmacyId, x.Type })
      .HasDatabaseName("ix_integration_sources_pharmacy_id_type");

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Cascade);
  }
}
