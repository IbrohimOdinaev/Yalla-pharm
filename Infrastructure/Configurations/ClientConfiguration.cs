using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.HasBaseType<User>();

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
