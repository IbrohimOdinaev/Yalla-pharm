using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class PaymentHistoryConfiguration : IEntityTypeConfiguration<PaymentHistory>
{
  public void Configure(EntityTypeBuilder<PaymentHistory> builder)
  {
    builder.ToTable("payment_histories");

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

    builder.Property(x => x.UserId)
      .HasColumnName("user_id")
      .HasColumnType("uuid");

    builder.Property(x => x.UserPhoneNumber)
      .HasColumnName("user_phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
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

    builder.Property(x => x.Provider)
      .HasColumnName("provider")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.ReceiverAccount)
      .HasColumnName("receiver_account")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.PaymentUrl)
      .HasColumnName("payment_url")
      .HasColumnType("character varying(2048)")
      .HasMaxLength(2048);

    builder.Property(x => x.PaymentComment)
      .HasColumnName("payment_comment")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.ConfirmedByUserId)
      .HasColumnName("confirmed_by_user_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.ConfirmedByPhoneNumber)
      .HasColumnName("confirmed_by_phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
      .IsRequired();

    builder.Property(x => x.PaidAtUtc)
      .HasColumnName("paid_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.HasIndex(x => x.OrderId)
      .IsUnique()
      .HasDatabaseName("ux_payment_histories_order_id");

    builder.HasIndex(x => x.UserId)
      .HasDatabaseName("ix_payment_histories_user_id");

    builder.HasIndex(x => x.PaidAtUtc)
      .HasDatabaseName("ix_payment_histories_paid_at_utc");

    builder.HasOne<Order>()
      .WithMany()
      .HasForeignKey(x => x.OrderId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.UserId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.ConfirmedByUserId)
      .OnDelete(DeleteBehavior.Restrict);
  }
}
