using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class ManualItemLookupRequestConfiguration
    : IEntityTypeConfiguration<ManualItemLookupRequest>
{
    public void Configure(EntityTypeBuilder<ManualItemLookupRequest> builder)
    {
        builder.ToTable("manual_item_lookup_requests");

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

        builder.Property(x => x.RequestedByPharmacistId)
          .HasColumnName("requested_by_pharmacist_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.ManualMedicineName)
          .HasColumnName("manual_medicine_name")
          .HasColumnType("character varying(200)")
          .HasMaxLength(PrescriptionChecklistItem.MaxManualNameLength)
          .IsRequired();

        builder.Property(x => x.RequestComment)
          .HasColumnName("request_comment")
          .HasColumnType("character varying(1000)")
          .HasMaxLength(ManualItemLookupRequest.MaxRequestCommentLength)
          .IsRequired(false);

        builder.Property(x => x.Status)
          .HasColumnName("status")
          .HasColumnType("integer")
          .HasConversion<int>()
          .IsRequired();

        builder.Property(x => x.CreatedAtUtc)
          .HasColumnName("created_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        builder.Property(x => x.ClosedAtUtc)
          .HasColumnName("closed_at_utc")
          .HasColumnType("timestamp")
          .IsRequired(false);

        // Admin "active" tab queries WHERE status = 0 ORDER BY created_at DESC —
        // the composite filtered index keeps that page-1 listing constant-time
        // even as history grows.
        builder.HasIndex(x => new { x.Status, x.CreatedAtUtc })
          .HasFilter("status = 0")
          .HasDatabaseName("ix_manual_item_lookup_requests_active");

        builder.HasIndex(x => x.PrescriptionId)
          .HasDatabaseName("ix_manual_item_lookup_requests_prescription_id");

        builder.HasIndex(x => x.RequestedByPharmacistId)
          .HasDatabaseName("ix_manual_item_lookup_requests_requested_by_pharmacist_id");

        builder.HasMany(x => x.Responses)
          .WithOne()
          .HasForeignKey(x => x.RequestId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(ManualItemLookupRequest.Responses))
          ?.SetField("_responses");
        builder.Metadata.FindNavigation(nameof(ManualItemLookupRequest.Responses))
          ?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
