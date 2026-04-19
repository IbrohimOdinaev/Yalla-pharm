using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedOnAdd()
          .IsRequired();

        builder.Property(x => x.ClientId)
          .HasColumnName("client_id")
          .HasColumnType("uuid");

        builder.Property(x => x.ClientPhoneNumber)
          .HasColumnName("client_phone_number")
          .HasColumnType("character varying(20)")
          .HasMaxLength(20)
          .IsRequired();

        builder.Property(x => x.PharmacyId)
          .HasColumnName("pharmacy_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.DeliveryAddress)
          .HasColumnName("delivery_address")
          .HasColumnType("character varying(500)")
          .HasMaxLength(500)
          .IsRequired();

        builder.Property(x => x.IsPickup)
          .HasColumnName("is_pickup")
          .HasColumnType("boolean")
          .HasDefaultValue(false)
          .IsRequired();

        builder.Property(x => x.IdempotencyKey)
          .HasColumnName("idempotency_key")
          .HasColumnType("character varying(128)")
          .HasMaxLength(128);

        builder.Property(x => x.OrderPlacedAt)
          .HasColumnName("order_placed_at")
          .HasColumnType("timestamp without time zone")
          .IsRequired();

        builder.Property(x => x.Cost)
          .HasColumnName("cost")
          .HasColumnType("numeric(18,2)")
          .HasPrecision(18, 2)
          .HasDefaultValue(0m)
          .IsRequired();

        builder.Property(x => x.ReturnCost)
          .HasColumnName("return_cost")
          .HasColumnType("numeric(18,2)")
          .HasPrecision(18, 2)
          .HasDefaultValue(0m)
          .IsRequired();

        builder.Property(x => x.Status)
          .HasColumnName("status")
          .HasColumnType("integer")
          .HasConversion<int>()
          .HasDefaultValue(Status.New)
          .IsRequired();

        builder.Property(x => x.PaymentState)
          .HasColumnName("payment_state")
          .HasColumnType("integer")
          .HasConversion<int>()
          .HasDefaultValue(OrderPaymentState.Confirmed)
          .IsRequired();

        builder.Property(x => x.PaymentAmount)
          .HasColumnName("payment_amount")
          .HasColumnType("numeric(18,2)")
          .HasPrecision(18, 2)
          .HasDefaultValue(0m)
          .IsRequired();

        builder.Property(x => x.PaymentCurrency)
          .HasColumnName("payment_currency")
          .HasColumnType("character varying(8)")
          .HasMaxLength(8)
          .HasDefaultValue("TJS")
          .IsRequired();

        builder.Property(x => x.PaymentProvider)
          .HasColumnName("payment_provider")
          .HasColumnType("character varying(64)")
          .HasMaxLength(64)
          .HasDefaultValue("Legacy")
          .IsRequired();

        builder.Property(x => x.PaymentReceiverAccount)
          .HasColumnName("payment_receiver_account")
          .HasColumnType("character varying(128)")
          .HasMaxLength(128)
          .HasDefaultValue(string.Empty)
          .IsRequired();

        builder.Property(x => x.PaymentUrl)
          .HasColumnName("payment_url")
          .HasColumnType("character varying(2048)")
          .HasMaxLength(2048);

        builder.Property(x => x.PaymentComment)
          .HasColumnName("payment_comment")
          .HasColumnType("character varying(512)")
          .HasMaxLength(512);

        builder.Property(x => x.PaymentExpiresAtUtc)
          .HasColumnName("payment_expires_at_utc")
          .HasColumnType("timestamp without time zone")
          .HasConversion(
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value);

        builder.Property(x => x.PaymentConfirmedAtUtc)
          .HasColumnName("payment_confirmed_at_utc")
          .HasColumnType("timestamp without time zone")
          .HasConversion(
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
            value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value);

        builder.Property(x => x.PaymentConfirmedByUserId)
          .HasColumnName("payment_confirmed_by_user_id")
          .HasColumnType("uuid");

        builder.Property(x => x.IsStockDeducted)
          .HasColumnName("is_stock_deducted")
          .HasColumnType("boolean")
          .HasDefaultValue(true)
          .IsRequired();

        builder.Property(x => x.Comment)
          .HasColumnName("comment")
          .HasColumnType("character varying(1024)")
          .HasMaxLength(1024);

        builder.HasIndex(x => x.ClientId)
          .HasDatabaseName("ix_orders_client_id");

        builder.HasIndex(x => x.PharmacyId)
          .HasDatabaseName("ix_orders_pharmacy_id");

        builder.HasIndex(x => x.Status)
          .HasDatabaseName("ix_orders_status");

        builder.HasIndex(x => x.PaymentState)
          .HasDatabaseName("ix_orders_payment_state");

        builder.HasIndex(x => new { x.Status, x.PaymentState, x.PaymentExpiresAtUtc })
          .HasDatabaseName("ix_orders_status_payment_state_payment_expires_at_utc");

        builder.HasIndex(x => new { x.ClientId, x.IdempotencyKey })
          .IsUnique()
          .HasDatabaseName("ux_orders_client_idempotency_key");

        builder.HasOne<Client>()
          .WithMany(x => x.Orders)
          .HasForeignKey(x => x.ClientId)
          .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Pharmacy>()
          .WithMany(x => x.Orders)
          .HasForeignKey(x => x.PharmacyId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<User>()
          .WithMany()
          .HasForeignKey(x => x.PaymentConfirmedByUserId)
          .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Positions)
          .WithOne()
          .HasForeignKey(x => x.OrderId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.DeliveryData)
          .WithOne(x => x.Order)
          .HasForeignKey<DeliveryData>(x => x.OrderId)
          .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Order.Positions))?.SetField("_positions");
        builder.Metadata.FindNavigation(nameof(Order.Positions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
