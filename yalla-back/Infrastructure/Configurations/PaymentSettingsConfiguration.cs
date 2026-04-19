using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class PaymentSettingsConfiguration : IEntityTypeConfiguration<PaymentSettings>
{
  public void Configure(EntityTypeBuilder<PaymentSettings> builder)
  {
    builder.ToTable("payment_settings");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.DcBaseUrl)
      .HasColumnName("dc_base_url")
      .HasColumnType("character varying(2048)")
      .HasMaxLength(2048)
      .IsRequired(false);

    builder.Property(x => x.UpdatedAtUtc)
      .HasColumnName("updated_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.UpdatedByUserId)
      .HasColumnName("updated_by_user_id")
      .HasColumnType("uuid")
      .IsRequired(false);
  }
}
