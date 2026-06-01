using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class StaffTelegramRecipientConfiguration : IEntityTypeConfiguration<StaffTelegramRecipient>
{
  public void Configure(EntityTypeBuilder<StaffTelegramRecipient> builder)
  {
    builder.ToTable("staff_telegram_recipients");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.PharmacyWorkerId)
      .HasColumnName("pharmacy_worker_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.ChatId)
      .HasColumnName("chat_id")
      .HasColumnType("bigint")
      .IsRequired();

    builder.Property(x => x.TelegramUserId)
      .HasColumnName("telegram_user_id")
      .HasColumnType("bigint")
      .IsRequired();

    builder.Property(x => x.TelegramUsername)
      .HasColumnName("telegram_username")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.TelegramFirstName)
      .HasColumnName("telegram_first_name")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.TelegramLastName)
      .HasColumnName("telegram_last_name")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.IsActive)
      .HasColumnName("is_active")
      .HasColumnType("boolean")
      .HasDefaultValue(true)
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

    builder.HasIndex(x => new { x.PharmacyWorkerId, x.ChatId })
      .IsUnique()
      .HasDatabaseName("ux_staff_tg_recipients_worker_chat");

    builder.HasIndex(x => new { x.PharmacyWorkerId, x.IsActive })
      .HasDatabaseName("ix_staff_tg_recipients_worker_active");
  }
}
