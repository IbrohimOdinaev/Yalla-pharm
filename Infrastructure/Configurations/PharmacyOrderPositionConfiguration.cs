using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yalla.Infrastructure.Configurations;

public class PharmacyOrderPosition
{
  public Guid PharmacyOrderId { get; set; }

  public Guid PositionId { get; set; }
}

public class PharmacyOrderPositionConfiguration : IEntityTypeConfiguration<PharmacyOrderPosition>
{
  public void Configure(EntityTypeBuilder<PharmacyOrderPosition> builder)
  {
    builder.ToTable("pharmacy_order_positions");

    builder.HasKey(x => new { x.PharmacyOrderId, x.PositionId });

    builder.Property(x => x.PharmacyOrderId)
      .HasColumnName("pharmacy_order_id")
      .HasColumnType("uuid");

    builder.Property(x => x.PositionId)
      .HasColumnName("position_id")
      .HasColumnType("uuid");
  }
}
