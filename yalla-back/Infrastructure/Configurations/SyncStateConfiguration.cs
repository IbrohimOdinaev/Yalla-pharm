using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
  public void Configure(EntityTypeBuilder<SyncState> builder)
  {
    builder.ToTable("sync_state");

    builder.HasKey(x => x.Key);

    builder.Property(x => x.Key)
      .HasColumnName("key")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.Value)
      .HasColumnName("value")
      .HasColumnType("text")
      .IsRequired();

    builder.Property(x => x.UpdatedAtUtc)
      .HasColumnName("updated_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();
  }
}
