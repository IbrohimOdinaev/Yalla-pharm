using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class StaffCompensationEarningConfiguration : IEntityTypeConfiguration<StaffCompensationEarning>
{
  public void Configure(EntityTypeBuilder<StaffCompensationEarning> builder)
  {
    builder.ToTable("staff_compensation_earnings");

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

    builder.Property(x => x.SourceType)
      .HasColumnName("source_type")
      .HasConversion<int>()
      .IsRequired();

    builder.Property(x => x.SourceId)
      .HasColumnName("source_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired(false);

    builder.Property(x => x.UnitRate)
      .HasColumnName("unit_rate")
      .HasColumnType("numeric(18,2)")
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

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasIndex(x => new { x.SourceType, x.SourceId })
      .IsUnique();

    builder.HasIndex(x => new { x.StaffUserId, x.CreatedAtUtc });

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.StaffUserId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Restrict);
  }
}
