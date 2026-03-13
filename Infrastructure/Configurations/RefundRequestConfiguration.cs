using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class RefundRequestConfiguration : IEntityTypeConfiguration<RefundRequest>
{
  public void Configure(EntityTypeBuilder<RefundRequest> builder)
  {
    builder.ToTable("refund_requests");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.OrderId)
      .HasColumnName("order_id")
      .HasColumnType("uuid");

    builder.Property(x => x.ClientId)
      .HasColumnName("client_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.PaymentTransactionId)
      .HasColumnName("payment_transaction_id")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.Amount)
      .HasColumnName("amount")
      .HasColumnType("numeric(18,2)")
      .HasPrecision(18, 2)
      .IsRequired();

    builder.Property(x => x.Currency)
      .HasColumnName("currency")
      .HasColumnType("character varying(8)")
      .HasMaxLength(8)
      .IsRequired();

    builder.Property(x => x.Reason)
      .HasColumnName("reason")
      .HasColumnType("character varying(1024)")
      .HasMaxLength(1024)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(RefundRequestStatus.Created)
      .IsRequired();

    builder.Property(x => x.CreatedAtUtc)
      .HasColumnName("created_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.Property(x => x.UpdatedAtUtc)
      .HasColumnName("updated_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => DateTime.SpecifyKind(value, DateTimeKind.Unspecified),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
      .IsRequired();

    builder.HasIndex(x => x.Status)
      .HasDatabaseName("ix_refund_requests_status");

    builder.HasIndex(x => x.OrderId)
      .HasDatabaseName("ix_refund_requests_order_id");

    builder.HasIndex(x => x.CreatedAtUtc)
      .HasDatabaseName("ix_refund_requests_created_at_utc");

    builder.HasOne<Client>()
      .WithMany()
      .HasForeignKey(x => x.ClientId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Order>()
      .WithMany()
      .HasForeignKey(x => x.OrderId)
      .OnDelete(DeleteBehavior.SetNull);
  }
}
