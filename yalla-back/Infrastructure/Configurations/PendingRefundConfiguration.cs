using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class PendingRefundConfiguration : IEntityTypeConfiguration<PendingRefund>
{
  public void Configure(EntityTypeBuilder<PendingRefund> builder)
  {
    builder.ToTable("pending_refunds");

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

    builder.Property(x => x.PrescriptionId)
      .HasColumnName("prescription_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.Amount)
      .HasColumnName("amount")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .IsRequired();

    builder.Property(x => x.Currency)
      .HasColumnName("currency")
      .HasColumnType("character varying(8)")
      .HasMaxLength(8)
      .IsRequired();

    builder.Property(x => x.Reason)
      .HasColumnName("reason")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp")
      .IsRequired();

    builder.Property(x => x.ProcessedAtUtc)
      .HasColumnName("processed_at_utc")
      .HasColumnType("timestamp")
      .IsRequired(false);

    builder.Property(x => x.ProcessedByUserId)
      .HasColumnName("processed_by_user_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.SuperAdminComment)
      .HasColumnName("super_admin_comment")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired(false);

    // "Show me everything I still owe" is the dominant query, so a
    // filtered partial index over the pending subset keeps it tight.
    builder.HasIndex(x => x.ProcessedAtUtc)
      .HasFilter("processed_at_utc IS NULL")
      .HasDatabaseName("ix_pending_refunds_unprocessed");

    builder.HasIndex(x => x.ClientId)
      .HasDatabaseName("ix_pending_refunds_client_id");

    builder.HasIndex(x => x.PrescriptionId)
      .HasDatabaseName("ix_pending_refunds_prescription_id");
  }
}
