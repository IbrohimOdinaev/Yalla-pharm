using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class StaffCompensationPayoutConfiguration : IEntityTypeConfiguration<StaffCompensationPayout>
{
  public void Configure(EntityTypeBuilder<StaffCompensationPayout> builder)
  {
    builder.ToTable("staff_compensation_payouts");

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
      .IsRequired();

    builder.Property(x => x.Currency)
      .HasColumnName("currency")
      .HasColumnType("character varying(8)")
      .HasMaxLength(8)
      .IsRequired();

    builder.Property(x => x.Method)
      .HasColumnName("method")
      .HasConversion<int>()
      .IsRequired();

    builder.Property(x => x.ReceiptImageKey)
      .HasColumnName("receipt_image_key")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512)
      .IsRequired(false);

    builder.Property(x => x.Note)
      .HasColumnName("note")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512)
      .IsRequired(false);

    builder.Property(x => x.PaidAtUtc)
      .HasColumnName("paid_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.PaidBySuperAdminId)
      .HasColumnName("paid_by_super_admin_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.HasIndex(x => new { x.StaffUserId, x.PaidAtUtc });

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.StaffUserId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.PaidBySuperAdminId)
      .OnDelete(DeleteBehavior.Restrict);
  }
}
