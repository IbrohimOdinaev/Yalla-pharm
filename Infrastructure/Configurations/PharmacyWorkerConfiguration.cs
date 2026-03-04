using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PharmacyWorkerConfiguration : IEntityTypeConfiguration<PharmacyWorker>
{
    public void Configure(EntityTypeBuilder<PharmacyWorker> builder)
    {
        builder.HasBaseType<User>();

        builder.Property(x => x.PharmacyId)
          .HasColumnName("pharmacy_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.HasIndex(x => x.PharmacyId)
          .HasDatabaseName("ix_users_pharmacy_id");

        builder.HasOne(x => x.Pharmacy)
          .WithMany()
          .HasForeignKey(x => x.PharmacyId)
          .OnDelete(DeleteBehavior.Cascade);
    }
}
