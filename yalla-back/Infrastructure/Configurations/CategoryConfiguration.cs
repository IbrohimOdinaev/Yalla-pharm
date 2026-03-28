using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedNever();

        builder.Property(x => x.Name)
          .HasColumnName("name")
          .HasColumnType("character varying(256)")
          .HasMaxLength(256)
          .IsRequired();

        builder.Property(x => x.Slug)
          .HasColumnName("slug")
          .HasColumnType("character varying(256)")
          .HasMaxLength(256)
          .IsRequired();

        builder.Property(x => x.ParentId)
          .HasColumnName("parent_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.Type)
          .HasColumnName("type")
          .HasColumnType("character varying(64)")
          .HasConversion<string?>()
          .HasMaxLength(64)
          .IsRequired(false);

        builder.Property(x => x.WooCommerceId)
          .HasColumnName("woo_commerce_id")
          .HasColumnType("integer")
          .IsRequired();

        builder.Property(x => x.Description)
          .HasColumnName("description")
          .HasColumnType("text")
          .HasDefaultValue(string.Empty);

        builder.Property(x => x.IsActive)
          .HasColumnName("is_active")
          .HasColumnType("boolean")
          .HasDefaultValue(true);

        builder.HasOne(x => x.Parent)
          .WithMany(x => x.Children)
          .HasForeignKey(x => x.ParentId)
          .OnDelete(DeleteBehavior.Restrict)
          .IsRequired(false);

        builder.HasIndex(x => x.WooCommerceId)
          .IsUnique()
          .HasDatabaseName("ix_categories_woo_commerce_id");

        builder.HasIndex(x => x.Slug)
          .IsUnique()
          .HasDatabaseName("ix_categories_slug");

        builder.Metadata.FindNavigation(nameof(Category.Children))?.SetField("_children");
        builder.Metadata.FindNavigation(nameof(Category.Children))?.SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.Metadata.FindNavigation(nameof(Category.Medicines))?.SetField("_medicines");
        builder.Metadata.FindNavigation(nameof(Category.Medicines))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
