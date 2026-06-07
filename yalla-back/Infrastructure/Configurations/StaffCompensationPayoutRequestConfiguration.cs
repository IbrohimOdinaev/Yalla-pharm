using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class StaffCompensationPayoutRequestConfiguration : IEntityTypeConfiguration<StaffCompensationPayoutRequest>
{
  public void Configure(EntityTypeBuilder<StaffCompensationPayoutRequest> builder)
  {
    builder.ToTable("staff_compensation_payout_requests");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.StaffUserId)
      .HasColumnName("staff_user_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.StaffRole)
      .HasColumnName("staff_role")
      .HasConversion<int>()
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

    builder.Property(x => x.Bank)
      .HasColumnName("bank")
      .HasConversion<int>()
      .HasDefaultValue(PharmacyWithdrawalBank.DushanbeCity)
      .IsRequired();

    builder.Property(x => x.WalletPhoneNumber)
      .HasColumnName("wallet_phone_number")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.DeepLinkUrl)
      .HasColumnName("deep_link_url")
      .HasColumnType("character varying(2048)")
      .HasMaxLength(2048)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasConversion<int>()
      .HasDefaultValue(PharmacyWithdrawalStatus.New)
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.CompletedAtUtc)
      .HasColumnName("completed_at_utc")
      .HasColumnType("timestamp without time zone");

    builder.Property(x => x.CompletedBySuperAdminId)
      .HasColumnName("completed_by_super_admin_id")
      .HasColumnType("uuid");

    builder.Property(x => x.PayoutId)
      .HasColumnName("payout_id")
      .HasColumnType("uuid");

    builder.Property(x => x.ReceiptImageKey)
      .HasColumnName("receipt_image_key")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.Note)
      .HasColumnName("note")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.HasIndex(x => new { x.StaffUserId, x.Status })
      .HasDatabaseName("ix_staff_compensation_payout_requests_staff_status");

    builder.HasIndex(x => new { x.Status, x.CreatedAtUtc })
      .HasDatabaseName("ix_staff_compensation_payout_requests_status_created_at");

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.StaffUserId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.CompletedBySuperAdminId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<StaffCompensationPayout>()
      .WithMany()
      .HasForeignKey(x => x.PayoutId)
      .OnDelete(DeleteBehavior.SetNull);
  }
}
