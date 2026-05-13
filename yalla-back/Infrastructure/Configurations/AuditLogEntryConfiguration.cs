using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
  public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
  {
    builder.ToTable("audit_log");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.OccurredAtUtc)
      .HasColumnName("occurred_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.ActorUserId)
      .HasColumnName("actor_user_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.ActorRole)
      .HasColumnName("actor_role")
      .HasColumnType("integer")
      .HasConversion<int?>()
      .IsRequired(false);

    builder.Property(x => x.ActorIp)
      .HasColumnName("actor_ip")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired(false);

    builder.Property(x => x.EntityType)
      .HasColumnName("entity_type")
      .HasColumnType("character varying(100)")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(x => x.EntityId)
      .HasColumnName("entity_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.Action)
      .HasColumnName("action")
      .HasColumnType("integer")
      .HasConversion<int>()
      .IsRequired();

    builder.Property(x => x.Summary)
      .HasColumnName("summary")
      .HasColumnType("character varying(500)")
      .HasMaxLength(AuditLogEntry.MaxSummaryLength)
      .IsRequired();

    // jsonb is the right call here — payloads are ad-hoc shapes that
    // we want to inspect with operator queries (e.g. WHERE
    // payload @> '{"orderId": "..."}') without unmarshalling rows.
    builder.Property(x => x.PayloadJson)
      .HasColumnName("payload")
      .HasColumnType("jsonb")
      .IsRequired(false);

    builder.Property(x => x.CorrelationId)
      .HasColumnName("correlation_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    // Filtered/composite indexes for the GET /api/audit-log paths:
    //
    //   • entity_type+entity_id → "audit trail for this specific row"
    //   • actor_user_id          → "what did this user do"
    //   • occurred_at_utc DESC   → default chronological list
    //   • correlation_id         → "replay this HTTP request"
    builder.HasIndex(x => new { x.EntityType, x.EntityId })
      .HasDatabaseName("ix_audit_log_entity_type_entity_id");

    builder.HasIndex(x => x.ActorUserId)
      .HasFilter("actor_user_id IS NOT NULL")
      .HasDatabaseName("ix_audit_log_actor_user_id");

    builder.HasIndex(x => x.OccurredAtUtc)
      .IsDescending()
      .HasDatabaseName("ix_audit_log_occurred_at_utc_desc");

    builder.HasIndex(x => x.CorrelationId)
      .HasFilter("correlation_id IS NOT NULL")
      .HasDatabaseName("ix_audit_log_correlation_id");
  }
}
