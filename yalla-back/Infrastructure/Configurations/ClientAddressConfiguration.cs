using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class ClientAddressConfiguration : IEntityTypeConfiguration<ClientAddress>
{
  public void Configure(EntityTypeBuilder<ClientAddress> builder)
  {
    builder.ToTable("client_addresses");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.ClientId)
      .HasColumnName("client_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.Address)
      .HasColumnName("address")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

    builder.Property(x => x.Title)
      .HasColumnName("title")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired(false);

    builder.Property(x => x.Latitude)
      .HasColumnName("latitude")
      .HasColumnType("double precision")
      .IsRequired();

    builder.Property(x => x.Longitude)
      .HasColumnName("longitude")
      .HasColumnType("double precision")
      .IsRequired();

    builder.Property(x => x.LastUsedAtUtc)
      .HasColumnName("last_used_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.HasOne<Client>()
      .WithMany()
      .HasForeignKey(x => x.ClientId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasIndex(x => new { x.ClientId, x.LastUsedAtUtc })
      .HasDatabaseName("ix_client_addresses_client_last_used");

    // Unique name per client (only when Title is set) — prevent two entries named "Дом"
    builder.HasIndex(x => new { x.ClientId, x.Title })
      .IsUnique()
      .HasFilter("title IS NOT NULL")
      .HasDatabaseName("ux_client_addresses_client_title");
  }
}
