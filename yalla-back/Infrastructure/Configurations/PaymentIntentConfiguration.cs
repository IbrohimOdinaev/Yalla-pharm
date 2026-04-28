using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Infrastructure.Configurations;

public sealed class PaymentIntentConfiguration : IEntityTypeConfiguration<PaymentIntent>
{
  public void Configure(EntityTypeBuilder<PaymentIntent> builder)
  {
    builder.ToTable("payment_intents");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.ReservedOrderId)
      .HasColumnName("reserved_order_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.ClientId)
      .HasColumnName("client_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.ClientPhoneNumber)
      .HasColumnName("client_phone_number")
      .HasColumnType("character varying(20)")
      .HasMaxLength(20)
      .IsRequired();

    builder.Property(x => x.PharmacyId)
      .HasColumnName("pharmacy_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.IsPickup)
      .HasColumnName("is_pickup")
      .HasColumnType("boolean")
      .HasDefaultValue(false)
      .IsRequired();

    builder.Property(x => x.DeliveryAddress)
      .HasColumnName("delivery_address")
      .HasColumnType("character varying(500)")
      .HasMaxLength(500)
      .IsRequired();

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

    builder.Property(x => x.PaymentProvider)
      .HasColumnName("payment_provider")
      .HasColumnType("character varying(64)")
      .HasMaxLength(64)
      .IsRequired();

    builder.Property(x => x.PaymentReceiverAccount)
      .HasColumnName("payment_receiver_account")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
      .IsRequired();

    builder.Property(x => x.PaymentUrl)
      .HasColumnName("payment_url")
      .HasColumnType("character varying(2048)")
      .HasMaxLength(2048);

    builder.Property(x => x.PaymentComment)
      .HasColumnName("payment_comment")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.State)
      .HasColumnName("state")
      .HasColumnType("integer")
      .HasConversion<int>()
      .HasDefaultValue(PaymentIntentState.Created)
      .IsRequired();

    builder.Property(x => x.IdempotencyKey)
      .HasColumnName("idempotency_key")
      .HasColumnType("character varying(128)")
      .HasMaxLength(128)
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

    builder.Property(x => x.ConfirmedAtUtc)
      .HasColumnName("confirmed_at_utc")
      .HasColumnType("timestamp without time zone")
      .HasConversion(
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Unspecified) : value,
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : value);

    builder.Property(x => x.ConfirmedByUserId)
      .HasColumnName("confirmed_by_user_id")
      .HasColumnType("uuid");

    builder.Property(x => x.RejectReason)
      .HasColumnName("reject_reason")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512);

    builder.Property(x => x.Entrance)
      .HasColumnName("entrance")
      .HasColumnType("integer");

    builder.Property(x => x.Floor)
      .HasColumnName("floor")
      .HasColumnType("integer");

    builder.Property(x => x.Apartment)
      .HasColumnName("apartment")
      .HasColumnType("integer");

    builder.HasIndex(x => x.ReservedOrderId)
      .IsUnique()
      .HasDatabaseName("ux_payment_intents_reserved_order_id");

    builder.HasIndex(x => new { x.ClientId, x.IdempotencyKey })
      .IsUnique()
      .HasDatabaseName("ux_payment_intents_client_idempotency_key");

    builder.HasIndex(x => x.State)
      .HasDatabaseName("ix_payment_intents_state");

    builder.HasIndex(x => x.CreatedAtUtc)
      .HasDatabaseName("ix_payment_intents_created_at_utc");

    builder.HasOne<Client>()
      .WithMany()
      .HasForeignKey(x => x.ClientId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<Pharmacy>()
      .WithMany()
      .HasForeignKey(x => x.PharmacyId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(x => x.ConfirmedByUserId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasMany(x => x.Positions)
      .WithOne()
      .HasForeignKey(x => x.PaymentIntentId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.Metadata.FindNavigation(nameof(PaymentIntent.Positions))?.SetField("_positions");
    builder.Metadata.FindNavigation(nameof(PaymentIntent.Positions))?.SetPropertyAccessMode(PropertyAccessMode.Field);
  }
}
