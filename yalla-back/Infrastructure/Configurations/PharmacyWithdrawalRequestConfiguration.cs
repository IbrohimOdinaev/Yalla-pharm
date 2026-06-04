using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class PharmacyWithdrawalRequestConfiguration : IEntityTypeConfiguration<PharmacyWithdrawalRequest>
{
  public void Configure(EntityTypeBuilder<PharmacyWithdrawalRequest> builder)
  {
    builder.ToTable("pharmacy_withdrawal_requests");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.RequestedByAdminId)
      .HasColumnName("requested_by_admin_id")
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

    builder.Property(x => x.ReceiptImageKey)
      .HasColumnName("receipt_image_key")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.SuperAdminComment)
      .HasColumnName("super_admin_comment")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.HasIndex(x => new { x.PharmacyId, x.Status })
      .HasDatabaseName("ix_pharmacy_withdrawal_requests_pharmacy_status");

    builder.HasIndex(x => new { x.Status, x.CreatedAtUtc })
      .HasDatabaseName("ix_pharmacy_withdrawal_requests_status_created_at");

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.RequestedByAdminId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.CompletedBySuperAdminId)
      .OnDelete(DeleteBehavior.Restrict);
  }
}
