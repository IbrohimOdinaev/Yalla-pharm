using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

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
          .IsRequired(false);

        builder.Property(x => x.Description)
          .HasColumnName("description")
          .HasColumnType("text")
          .HasDefaultValue(string.Empty);

        builder.Property(x => x.IsActive)
          .HasColumnName("is_active")
          .HasColumnType("boolean")
          .HasDefaultValue(true)
          .IsRequired();

        builder.Property(x => x.WooCommerceId)
          .HasColumnName("woo_commerce_id")
          .HasColumnType("integer")
          .IsRequired(false);

        builder.Property(x => x.Slug)
          .HasColumnName("slug")
          .HasColumnType("character varying(256)")
          .HasMaxLength(256)
          .IsRequired(false);

        builder.Property(x => x.Id1C)
          .HasColumnName("id_1c")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.CategoryId)
          .HasColumnName("category_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.HasOne(x => x.Category)
          .WithMany(x => x.Medicines)
          .HasForeignKey(x => x.CategoryId)
          .OnDelete(DeleteBehavior.SetNull)
          .IsRequired(false);

        builder.HasIndex(x => x.Articul)
          .IsUnique()
          .HasFilter("articul IS NOT NULL")
          .HasDatabaseName("ix_medicines_articul");

        builder.HasIndex(x => x.WooCommerceId)
          .IsUnique()
          .HasFilter("woo_commerce_id IS NOT NULL")
          .HasDatabaseName("ix_medicines_woo_commerce_id");

        builder.HasIndex(x => x.Slug)
          .IsUnique()
          .HasFilter("slug IS NOT NULL")
          .HasDatabaseName("ix_medicines_slug");

        builder.HasIndex(x => x.Id1C)
          .IsUnique()
          .HasFilter("id_1c IS NOT NULL")
          .HasDatabaseName("ix_medicines_id_1c");

        builder.HasIndex(x => x.CategoryId)
          .HasDatabaseName("ix_medicines_category_id");

        builder.OwnsMany(x => x.Atributes, attr =>
        {
            attr.ToTable("medicine_attributes");

            attr.WithOwner().HasForeignKey("medicine_id");

            attr.Property<int>("id")
          .HasColumnName("id")
          .HasColumnType("integer")
          .ValueGeneratedOnAdd();

            attr.HasKey("id");

            attr.Property(a => a.Type)
          .HasColumnName("type")
          .HasColumnType("character varying(64)")
          .HasConversion<string>()
          .HasMaxLength(64)
          .IsRequired();

            attr.Property(a => a.Value)
          .HasColumnName("value")
          .HasColumnType("character varying(500)")
          .HasMaxLength(500)
          .IsRequired();
        });

        builder.Metadata.FindNavigation(nameof(Medicine.Atributes))?.SetField("_atributes");
        builder.Metadata.FindNavigation(nameof(Medicine.Atributes))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Medicine.Offers))?.SetField("_offers");
        builder.Metadata.FindNavigation(nameof(Medicine.Offers))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Medicine.Images))?.SetField("_images");
        builder.Metadata.FindNavigation(nameof(Medicine.Images))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
