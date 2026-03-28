using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PharmacyConfiguration : IEntityTypeConfiguration<Pharmacy>
{
    public void Configure(EntityTypeBuilder<Pharmacy> builder)
    {
        builder.ToTable("pharmacies");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedOnAdd()
          .IsRequired();

        builder.Property(x => x.Title)
          .HasColumnName("title")
          .HasColumnType("character varying(256)")
          .HasMaxLength(256)
          .IsRequired();

        builder.Property(x => x.Address)
          .HasColumnName("address")
          .HasColumnType("character varying(512)")
          .HasMaxLength(512)
          .IsRequired();

        builder.Property(x => x.AdminId)
          .HasColumnName("admin_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.IsActive)
          .HasColumnName("is_active")
          .HasColumnType("boolean")
          .HasDefaultValue(true)
          .IsRequired();

        builder.Property(x => x.Latitude)
          .HasColumnName("latitude")
          .HasColumnType("double precision")
          .IsRequired(false);

        builder.Property(x => x.Longitude)
          .HasColumnName("longitude")
          .HasColumnType("double precision")
          .IsRequired(false);

        builder.HasIndex(x => x.AdminId)
          .HasDatabaseName("ix_pharmacies_admin_id");

        builder.HasMany(x => x.Orders)
          .WithOne()
          .HasForeignKey(x => x.PharmacyId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Pharmacy.Orders))?.SetField("_orders");
        builder.Metadata.FindNavigation(nameof(Pharmacy.Orders))?.SetPropertyAccessMode(PropertyAccessMode.Field);

    }
}
