using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PrescriptionImageConfiguration : IEntityTypeConfiguration<PrescriptionImage>
{
    public void Configure(EntityTypeBuilder<PrescriptionImage> builder)
    {
        builder.ToTable("prescription_images");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedNever()
          .IsRequired();

        builder.Property(x => x.PrescriptionId)
          .HasColumnName("prescription_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.Key)
          .HasColumnName("key")
          .HasColumnType("character varying(500)")
          .HasMaxLength(500)
          .IsRequired();

        builder.Property(x => x.OrderIndex)
          .HasColumnName("order_index")
          .HasColumnType("integer")
          .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
          .HasColumnName("created_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        builder.HasIndex(x => x.PrescriptionId)
          .HasDatabaseName("ix_prescription_images_prescription_id");

        builder.HasIndex(x => new { x.PrescriptionId, x.OrderIndex })
          .IsUnique()
          .HasDatabaseName("ux_prescription_images_prescription_id_order_index");
    }
}
