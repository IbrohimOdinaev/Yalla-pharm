using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class ManualItemLookupResponseConfiguration
    : IEntityTypeConfiguration<ManualItemLookupResponse>
{
    public void Configure(EntityTypeBuilder<ManualItemLookupResponse> builder)
    {
        builder.ToTable("manual_item_lookup_responses");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedNever()
          .IsRequired();

        builder.Property(x => x.RequestId)
          .HasColumnName("request_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.RespondingPharmacyId)
          .HasColumnName("responding_pharmacy_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.RespondingAdminId)
          .HasColumnName("responding_admin_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.FullName)
          .HasColumnName("full_name")
          .HasColumnType("character varying(256)")
          .HasMaxLength(ManualItemLookupResponse.MaxFullNameLength)
          .IsRequired();

        builder.Property(x => x.Price)
          .HasColumnName("price")
          .HasColumnType("numeric(18, 2)")
          .IsRequired();

        builder.Property(x => x.Quantity)
          .HasColumnName("quantity")
          .HasColumnType("integer")
          .IsRequired();

        builder.Property(x => x.ImageKey)
          .HasColumnName("image_key")
          .HasColumnType("character varying(1024)")
          .HasMaxLength(1024)
          .IsRequired(false);

        builder.Property(x => x.ResponseComment)
          .HasColumnName("response_comment")
          .HasColumnType("character varying(1000)")
          .HasMaxLength(ManualItemLookupResponse.MaxResponseCommentLength)
          .IsRequired(false);

        builder.Property(x => x.CreatedAtUtc)
          .HasColumnName("created_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        builder.Property(x => x.UpdatedAtUtc)
          .HasColumnName("updated_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        // Each pharmacy can have at most one response per request — the
        // domain upserts via the parent aggregate, but we enforce the
        // invariant at the DB level so a misuse (e.g. raw INSERT) can't
        // create duplicates.
        builder.HasIndex(x => new { x.RequestId, x.RespondingPharmacyId })
          .IsUnique()
          .HasDatabaseName("ix_manual_item_lookup_responses_request_pharmacy");
    }
}
