using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PrescriptionConfiguration : IEntityTypeConfiguration<Prescription>
{
    public void Configure(EntityTypeBuilder<Prescription> builder)
    {
        builder.ToTable("prescriptions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedNever()
          .IsRequired();

        builder.Property(x => x.ClientId)
          .HasColumnName("client_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.PatientAge)
          .HasColumnName("patient_age")
          .HasColumnType("integer")
          .IsRequired();

        builder.Property(x => x.ClientComment)
          .HasColumnName("client_comment")
          .HasColumnType("character varying(1000)")
          .HasMaxLength(Prescription.MaxClientCommentLength)
          .IsRequired(false);

        builder.Property(x => x.Status)
          .HasColumnName("status")
          .HasColumnType("integer")
          .HasConversion<int>()
          .IsRequired();

        builder.Property(x => x.AssignedPharmacistId)
          .HasColumnName("assigned_pharmacist_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.DecodedAtUtc)
          .HasColumnName("decoded_at_utc")
          .HasColumnType("timestamp")
          .IsRequired(false);

        builder.Property(x => x.PharmacistOverallComment)
          .HasColumnName("pharmacist_overall_comment")
          .HasColumnType("character varying(2000)")
          .HasMaxLength(Prescription.MaxPharmacistCommentLength)
          .IsRequired(false);

        builder.Property(x => x.PaymentIntentId)
          .HasColumnName("payment_intent_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.OrderId)
          .HasColumnName("order_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.CreatedAtUtc)
          .HasColumnName("created_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        builder.Property(x => x.UpdatedAtUtc)
          .HasColumnName("updated_at_utc")
          .HasColumnType("timestamp")
          .IsRequired(false);

        builder.HasIndex(x => x.ClientId)
          .HasDatabaseName("ix_prescriptions_client_id");

        builder.HasIndex(x => x.Status)
          .HasDatabaseName("ix_prescriptions_status");

        builder.HasIndex(x => x.AssignedPharmacistId)
          .HasFilter("assigned_pharmacist_id IS NOT NULL")
          .HasDatabaseName("ix_prescriptions_assigned_pharmacist_id");

        builder.HasMany(x => x.Images)
          .WithOne()
          .HasForeignKey(x => x.PrescriptionId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Items)
          .WithOne()
          .HasForeignKey(x => x.PrescriptionId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Prescription.Images))?.SetField("_images");
        builder.Metadata.FindNavigation(nameof(Prescription.Images))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Prescription.Items))?.SetField("_items");
        builder.Metadata.FindNavigation(nameof(Prescription.Items))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
