using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class CheckoutRequestConfiguration : IEntityTypeConfiguration<CheckoutRequest>
{
  public void Configure(EntityTypeBuilder<CheckoutRequest> builder)
  {
    builder.ToTable("checkout_requests");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.ClientId)
      .HasColumnName("client_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.IdempotencyKey)
      .HasColumnName("idempotency_key")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.RequestHash)
      .HasColumnName("request_hash")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(CheckoutRequestStatus.Pending)
      .IsRequired();

    builder.Property(x => x.OrderId)
      .HasColumnName("order_id")
      .HasColumnType("uuid");

    builder.Property(x => x.PaymentTransactionId)
      .HasColumnName("payment_transaction_id")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128);

    builder.Property(x => x.FailureReason)
      .HasColumnName("failure_reason")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

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

    builder.HasIndex(x => new { x.ClientId, x.IdempotencyKey })
      .IsUnique()
      .HasDatabaseName("ux_checkout_requests_client_idempotency_key");

    builder.HasIndex(x => x.Status)
      .HasDatabaseName("ix_checkout_requests_status");

    builder.HasIndex(x => x.OrderId)
      .HasDatabaseName("ix_checkout_requests_order_id");

    builder.HasOne<Client>()
      .WithMany()
      .HasForeignKey(x => x.ClientId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Order>()
      .WithMany()
      .HasForeignKey(x => x.OrderId)
      .OnDelete(DeleteBehavior.SetNull);
  }
}
