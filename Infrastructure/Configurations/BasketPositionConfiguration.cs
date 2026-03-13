using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class BasketPositionConfiguration : IEntityTypeConfiguration<BasketPosition>
{
    public void Configure(EntityTypeBuilder<BasketPosition> builder)
    {
        builder.ToTable("basket_positions");

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

        builder.Property(x => x.MedicineId)
          .HasColumnName("medicine_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.Quantity)
          .HasColumnName("quantity")
          .HasColumnType("integer")
          .HasDefaultValue(1)
          .IsRequired();

        builder.HasIndex(x => x.ClientId)
          .HasDatabaseName("ix_basket_positions_client_id");

        builder.HasIndex(x => x.MedicineId)
          .HasDatabaseName("ix_basket_positions_medicine_id");

        builder.HasOne(x => x.Medicine)
          .WithMany()
          .HasForeignKey(x => x.MedicineId)
          .OnDelete(DeleteBehavior.Restrict);
    }
}
