using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
  public static readonly Guid DefaultSuperAdminId = Guid.Parse("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a");
  private const string DefaultSuperAdminName = "SuperAdmin";
  private const string DefaultSuperAdminPhoneNumber = "919191919";
  private const string DefaultSuperAdminPasswordHash = "$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.";

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

    builder.Property(x => x.PasswordHash)
      .HasColumnName("password_hash")
      .HasColumnType("character varying(200)")
      .HasMaxLength(200)
      .IsRequired();

    builder.Property(x => x.Role)
      .HasColumnName("Role")
      .HasColumnType("integer")
      .HasConversion<int>()
      .ValueGeneratedNever()
      .IsRequired();

    builder.Property(x => x.Gender)
      .HasColumnName("gender")
      .HasColumnType("integer")
      .HasConversion<int?>()
      .IsRequired(false);

    builder.Property(x => x.DateOfBirth)
      .HasColumnName("date_of_birth")
      .HasColumnType("date")
      .IsRequired(false);

    builder.HasIndex(x => x.PhoneNumber)
      .IsUnique()
      .HasDatabaseName("ix_users_phone_number");

    builder.HasDiscriminator<string>("user_type")
      .HasValue<User>("User")
      .HasValue<Client>("client")
      .HasValue<PharmacyWorker>("pharmacy_worker");

    builder.Property("user_type")
      .HasColumnName("user_type")
      .HasColumnType("character varying(40)")
      .HasMaxLength(40)
      .IsRequired();

    builder.HasData(new
    {
      Id = DefaultSuperAdminId,
      Name = DefaultSuperAdminName,
      PhoneNumber = DefaultSuperAdminPhoneNumber,
      PasswordHash = DefaultSuperAdminPasswordHash,
      Role = Role.SuperAdmin,
      user_type = "User"
    });
  }
}
