using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class TelegramAuthSessionConfiguration : IEntityTypeConfiguration<TelegramAuthSession>
{
  public void Configure(EntityTypeBuilder<TelegramAuthSession> builder)
  {
    builder.ToTable("telegram_auth_sessions");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.Nonce)
      .HasColumnName("nonce")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("integer")
      .HasConversion<int>()
      .IsRequired();

    builder.Property(x => x.InitiatingUserId)
      .HasColumnName("initiating_user_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.TelegramUserId)
      .HasColumnName("telegram_user_id")
      .HasColumnType("bigint")
      .IsRequired(false);

    builder.Property(x => x.TelegramUsername)
      .HasColumnName("telegram_username")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired(false);

    builder.Property(x => x.TelegramFirstName)
      .HasColumnName("telegram_first_name")
      .HasColumnType("character varying(200)")
      .HasMaxLength(200)
      .IsRequired(false);

    builder.Property(x => x.TelegramLastName)
      .HasColumnName("telegram_last_name")
      .HasColumnType("character varying(200)")
      .HasMaxLength(200)
      .IsRequired(false);

    builder.Property(x => x.ConfirmationChatId)
      .HasColumnName("confirmation_chat_id")
      .HasColumnType("bigint")
      .IsRequired(false);

    builder.Property(x => x.ConfirmationMessageId)
      .HasColumnName("confirmation_message_id")
      .HasColumnType("integer")
      .IsRequired(false);

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.ExpiresAtUtc)
      .HasColumnName("expires_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.UpdatedAtUtc)
      .HasColumnName("updated_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.ConsumedAtUtc)
      .HasColumnName("consumed_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired(false);

    builder.HasIndex(x => x.Nonce)
      .IsUnique()
      .HasDatabaseName("ix_telegram_auth_sessions_nonce");

    builder.HasIndex(x => x.ExpiresAtUtc)
      .HasDatabaseName("ix_telegram_auth_sessions_expires_at_utc");
  }
}
