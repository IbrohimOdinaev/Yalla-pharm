using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class HomePopularMedicineConfiguration : IEntityTypeConfiguration<HomePopularMedicine>
{
  public void Configure(EntityTypeBuilder<HomePopularMedicine> builder)
  {
    builder.ToTable("home_popular_medicines");

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

    builder.Property(x => x.Position)
      .HasColumnName("position")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasOne(x => x.Medicine)
      .WithMany()
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasIndex(x => x.MedicineId)
      .IsUnique()
      .HasDatabaseName("ux_home_popular_medicines_medicine_id");

    builder.HasIndex(x => x.Position)
      .IsUnique()
      .HasDatabaseName("ux_home_popular_medicines_position");
  }
}
