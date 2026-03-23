using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class SmsVerificationSessionConfiguration : IEntityTypeConfiguration<SmsVerificationSession>
{
  public void Configure(EntityTypeBuilder<SmsVerificationSession> builder)
  {
    builder.ToTable("sms_verification_sessions");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.Purpose)
      .HasColumnName("purpose")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(SmsVerificationPurpose.ClientRegistration)
      .IsRequired();

    builder.Property(x => x.PhoneNumber)
      .HasColumnName("phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
      .IsRequired();

    builder.Property(x => x.CodeHash)
      .HasColumnName("code_hash")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.PayloadJson)
      .HasColumnName("payload_json")
      .HasColumnType("text");

    builder.Property(x => x.LastTxnId)
      .HasColumnName("last_txn_id")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64);

    builder.Property(x => x.LastMsgId)
      .HasColumnName("last_msg_id")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64);

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(SmsVerificationStatus.Pending)
      .IsRequired();

    builder.Property(x => x.AttemptsRemaining)
      .HasColumnName("attempts_remaining")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.ResendsRemaining)
      .HasColumnName("resends_remaining")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.ExpiresAtUtc)
      .HasColumnName("expires_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.Property(x => x.ResendAvailableAtUtc)
      .HasColumnName("resend_available_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

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

    builder.Property(x => x.VerifiedAtUtc)
      .HasColumnName("verified_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value);

    builder.Property(x => x.FailureReason)
      .HasColumnName("failure_reason")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.HasIndex(x => new { x.Purpose, x.PhoneNumber, x.Status })
      .HasDatabaseName("ix_sms_verification_sessions_purpose_phone_status");

    builder.HasIndex(x => x.ExpiresAtUtc)
      .HasDatabaseName("ix_sms_verification_sessions_expires_at_utc");
  }
}
