using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class OfferConfiguration : IEntityTypeConfiguration<Offer>
{
  public void Configure(EntityTypeBuilder<Offer> builder)
  {
    builder.ToTable("offers");

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

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.StockQuantity)
      .HasColumnName("stock_quantity")
      .HasColumnType("integer")
      .HasDefaultValue(0)
      .IsRequired();

    builder.Property(x => x.Price)
      .HasColumnName("price")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .HasDefaultValue(0m)
      .IsRequired();

    builder.HasIndex(x => x.PharmacyId)
      .HasDatabaseName("ix_offers_pharmacy_id");

    builder.HasIndex(x => new { x.MedicineId, x.PharmacyId })
      .IsUnique()
      .HasDatabaseName("ux_offers_medicine_id_pharmacy_id");

    builder.HasOne<Medicine>()
      .WithMany(x => x.Offers)
      .HasForeignKey(x => x.MedicineId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Cascade);
  }
}
