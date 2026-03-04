using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
  public void Configure(EntityTypeBuilder<User> builder)
  {
    builder.ToTable("users");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.Name)
      .HasColumnName("name")
      .HasColumnType("character varying(200)")
      .HasMaxLength(200)
      .IsRequired();

    builder.Property(x => x.PhoneNumber)
      .HasColumnName("phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
      .IsRequired();

    builder.HasIndex(x => x.PhoneNumber)
      .IsUnique()
      .HasDatabaseName("ix_users_phone_number");

    builder.HasDiscriminator<string>("user_type")
      .HasValue<Client>("client")
      .HasValue<PharmacyWorker>("pharmacy_worker");

    builder.Property("user_type")
      .HasColumnName("user_type")
      .HasColumnType("character varying(40)")
      .HasMaxLength(40)
      .IsRequired();
  }
}
