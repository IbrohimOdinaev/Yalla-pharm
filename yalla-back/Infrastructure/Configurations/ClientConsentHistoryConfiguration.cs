using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class ClientConsentHistoryConfiguration : IEntityTypeConfiguration<ClientConsentHistory>
{
  public void Configure(EntityTypeBuilder<ClientConsentHistory> builder)
  {
    builder.ToTable("client_consent_history");

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

    builder.Property(x => x.PolicyVersion)
      .HasColumnName("policy_version")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.AcceptedAtUtc)
      .HasColumnName("accepted_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.Property(x => x.AcceptedFromIp)
      .HasColumnName("accepted_from_ip")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired(false);

    builder.Property(x => x.UserAgent)
      .HasColumnName("user_agent")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired(false);

    // Two natural query paths: "all consents by client" and "all
    // consents for a specific policy version". Both deserve indexes —
    // policy_version filtering will be common during legal reviews
    // when proving that all active users have re-accepted a new rev.
    builder.HasIndex(x => x.ClientId)
      .HasDatabaseName("ix_client_consent_history_client_id");

    builder.HasIndex(x => x.PolicyVersion)
      .HasDatabaseName("ix_client_consent_history_policy_version");

    builder.HasIndex(x => x.AcceptedAtUtc)
      .IsDescending()
      .HasDatabaseName("ix_client_consent_history_accepted_at_utc_desc");

    builder.HasOne<Client>()
      .WithMany()
      .HasForeignKey(x => x.ClientId)
      .OnDelete(DeleteBehavior.Cascade);
  }
}
