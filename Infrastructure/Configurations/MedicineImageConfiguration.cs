using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class MedicineImageConfiguration : IEntityTypeConfiguration<MedicineImage>
{
  public void Configure(EntityTypeBuilder<MedicineImage> builder)
  {
    builder.ToTable("medicine_images");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.Key)
      .HasColumnName("key")
      .HasColumnType("character varying(1024)")
      .HasMaxLength(1024)
      .IsRequired();

    builder.Property(x => x.IsMain)
      .HasColumnName("is_main")
      .HasColumnType("boolean")
      .IsRequired();

    builder.Property(x => x.IsMinimal)
      .HasColumnName("is_minimal")
      .HasColumnType("boolean")
      .IsRequired();

    builder.Property(x => x.MedicineId)
      .HasColumnName("medicine_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.HasOne(x => x.Medicine)
      .WithMany(x => x.Images)
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasIndex(x => new { x.MedicineId, x.IsMain })
      .HasDatabaseName("ux_medicine_images_medicine_main")
      .IsUnique()
      .HasFilter("is_main");

    builder.HasIndex(x => new { x.MedicineId, x.IsMinimal })
      .HasDatabaseName("ux_medicine_images_medicine_minimal")
      .IsUnique()
      .HasFilter("is_minimal");
  }
}
