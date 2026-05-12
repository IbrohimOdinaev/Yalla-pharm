using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.HasBaseType<User>();

        // Privacy-policy acceptance fields stored on the TPH client row
        // (the discriminator is "client" — see UserConfiguration). All
        // nullable so existing clients that pre-date the gate keep
        // working until they accept; the application layer enforces
        // acceptance before any sensitive flow.
        builder.Property(x => x.PrivacyPolicyVersionAccepted)
          .HasColumnName("privacy_policy_version_accepted")
          .HasColumnType("character varying(64)")
          .HasMaxLength(64)
          .IsRequired(false);

        builder.Property(x => x.PrivacyPolicyAcceptedAtUtc)
          .HasColumnName("privacy_policy_accepted_at_utc")
          .HasColumnType("timestamp without time zone")
          .HasConversion(
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value)
          .IsRequired(false);

        builder.Property(x => x.PrivacyPolicyAcceptedFromIp)
          .HasColumnName("privacy_policy_accepted_from_ip")
          .HasColumnType("character varying(64)")
          .HasMaxLength(64)
          .IsRequired(false);

        builder.HasMany(x => x.Orders)
          .WithOne()
          .HasForeignKey(x => x.ClientId);

        builder.HasMany(x => x.BasketPositions)
          .WithOne()
          .HasForeignKey(x => x.ClientId);

        builder.Metadata.FindNavigation(nameof(Client.Orders))?.SetField("_orders");
        builder.Metadata.FindNavigation(nameof(Client.Orders))?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Client.BasketPositions))?.SetField("_basketPositions");
        builder.Metadata.FindNavigation(nameof(Client.BasketPositions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
