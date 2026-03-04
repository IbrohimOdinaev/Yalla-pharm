using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yalla.Infrastructure.Configurations;

public class OrderRejectedPosition
{
  public Guid OrderId { get; set; }

  public Guid PositionId { get; set; }
}

public class OrderRejectedPositionConfiguration : IEntityTypeConfiguration<OrderRejectedPosition>
{
  public void Configure(EntityTypeBuilder<OrderRejectedPosition> builder)
  {
    builder.ToTable("order_rejected_positions");

    builder.HasKey(x => new { x.OrderId, x.PositionId });

    builder.Property(x => x.OrderId)
      .HasColumnName("order_id")
      .HasColumnType("uuid");

    builder.Property(x => x.PositionId)
      .HasColumnName("position_id")
      .HasColumnType("uuid");

  }
}
