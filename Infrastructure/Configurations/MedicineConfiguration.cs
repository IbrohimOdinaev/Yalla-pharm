using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class MedicineConfiguration : IEntityTypeConfiguration<Medicine>
{
    public void Configure(EntityTypeBuilder<Medicine> builder)
    {
        builder.ToTable("medicines");

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

        builder.Property(x => x.Articul)
          .HasColumnName("articul")
          .HasColumnType("character varying(128)")
          .HasMaxLength(128)
          .IsRequired();

        builder.Property(x => x.Url)
          .HasColumnName("url")
          .HasColumnType("character varying(1024)")
          .HasMaxLength(1024);

        builder.Property(x => x.IsActive)
          .HasColumnName("is_active")
          .HasColumnType("boolean")
          .HasDefaultValue(true)
          .IsRequired();

        builder.HasIndex(x => x.Articul)
          .IsUnique()
          .HasDatabaseName("ix_medicines_articul");

        builder.OwnsMany(x => x.Atributes, attr =>
        {
            attr.ToTable("medicine_attributes");

            attr.WithOwner().HasForeignKey("medicine_id");

            attr.Property<int>("id")
          .HasColumnName("id")
          .HasColumnType("integer")
          .ValueGeneratedOnAdd();

            attr.HasKey("id");

            attr.Property(a => a.Name)
          .HasColumnName("name")
          .HasColumnType("character varying(200)")
          .HasMaxLength(200)
          .IsRequired();

            attr.Property(a => a.Option)
          .HasColumnName("option")
          .HasColumnType("character varying(500)")
          .HasMaxLength(500)
          .IsRequired();
        });

        builder.Metadata.FindNavigation(nameof(Medicine.Atributes))?.SetField("_atributes");
        builder.Metadata.FindNavigation(nameof(Medicine.Atributes))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Medicine.Offers))?.SetField("_offers");
        builder.Metadata.FindNavigation(nameof(Medicine.Offers))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
