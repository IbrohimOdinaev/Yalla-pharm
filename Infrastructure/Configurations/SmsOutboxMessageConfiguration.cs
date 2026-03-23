using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class SmsOutboxMessageConfiguration : IEntityTypeConfiguration<SmsOutboxMessage>
{
  public void Configure(EntityTypeBuilder<SmsOutboxMessage> builder)
  {
    builder.ToTable("sms_outbox_messages");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.OrderId)
      .HasColumnName("order_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.PhoneNumber)
      .HasColumnName("phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
      .IsRequired();

    builder.Property(x => x.StatusSnapshot)
      .HasColumnName("status_snapshot")
      .HasColumnType("integer")
      .HasConversion<int>()
      .IsRequired();

    builder.Property(x => x.Message)
      .HasColumnName("message")
      .HasColumnType("character varying(1000)")
      .HasMaxLength(1000)
      .IsRequired();

    builder.Property(x => x.Provider)
      .HasColumnName("provider")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.AttemptCount)
      .HasColumnName("attempt_count")
      .HasColumnType("integer")
      .HasDefaultValue(0)
      .IsRequired();

    builder.Property(x => x.NextAttemptAtUtc)
      .HasColumnName("next_attempt_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.Property(x => x.SentAtUtc)
      .HasColumnName("sent_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value);

    builder.Property(x => x.State)
      .HasColumnName("state")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(SmsOutboxState.Pending)
      .IsRequired();

    builder.Property(x => x.TxnId)
      .HasColumnName("txn_id")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.MsgId)
      .HasColumnName("msg_id")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.LastErrorCode)
      .HasColumnName("last_error_code")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64);

    builder.Property(x => x.LastErrorMessage)
      .HasColumnName("last_error_message")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.Property(x => x.UpdatedAtUtc)
      .HasColumnName("updated_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.HasIndex(x => new { x.OrderId, x.StatusSnapshot, x.PhoneNumber })
      .IsUnique()
      .HasDatabaseName("ux_sms_outbox_order_status_phone");

    builder.HasIndex(x => new { x.State, x.NextAttemptAtUtc })
      .HasDatabaseName("ix_sms_outbox_state_next_attempt_at_utc");

    builder.HasIndex(x => x.CreatedAtUtc)
      .HasDatabaseName("ix_sms_outbox_created_at_utc");
  }
}
