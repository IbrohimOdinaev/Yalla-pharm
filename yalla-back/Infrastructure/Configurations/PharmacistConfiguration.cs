using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PharmacistConfiguration : IEntityTypeConfiguration<Pharmacist>
{
    public void Configure(EntityTypeBuilder<Pharmacist> builder)
    {
        // Pharmacist has no extra columns yet — TPH inheritance handles
        // everything via the base User table + the user_type discriminator.
        builder.HasBaseType<User>();
    }
}
