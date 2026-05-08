using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public class PrescriptionChecklistItemConfiguration
    : IEntityTypeConfiguration<PrescriptionChecklistItem>
{
    public void Configure(EntityTypeBuilder<PrescriptionChecklistItem> builder)
    {
        builder.ToTable("prescription_checklist_items");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
          .HasColumnName("id")
          .HasColumnType("uuid")
          .ValueGeneratedNever()
          .IsRequired();

        builder.Property(x => x.PrescriptionId)
          .HasColumnName("prescription_id")
          .HasColumnType("uuid")
          .IsRequired();

        builder.Property(x => x.MedicineId)
          .HasColumnName("medicine_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.ManualMedicineName)
          .HasColumnName("manual_medicine_name")
          .HasColumnType("character varying(200)")
          .HasMaxLength(PrescriptionChecklistItem.MaxManualNameLength)
          .IsRequired(false);

        builder.Property(x => x.Quantity)
          .HasColumnName("quantity")
          .HasColumnType("integer")
          .IsRequired();

        builder.Property(x => x.PharmacistComment)
          .HasColumnName("pharmacist_comment")
          .HasColumnType("character varying(1000)")
          .HasMaxLength(PrescriptionChecklistItem.MaxPharmacistCommentLength)
          .IsRequired(false);

        builder.Property(x => x.Kind)
          .HasColumnName("kind")
          .HasColumnType("integer")
          .HasConversion<int>()
          .HasDefaultValue(Yalla.Domain.Enums.PrescriptionChecklistItemKind.Original)
          .IsRequired();

        builder.Property(x => x.AnalogMedicineId)
          .HasColumnName("analog_medicine_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.AnalogItemId)
          .HasColumnName("analog_item_id")
          .HasColumnType("uuid")
          .IsRequired(false);

        builder.Property(x => x.CreatedAtUtc)
          .HasColumnName("created_at_utc")
          .HasColumnType("timestamp")
          .IsRequired();

        builder.HasIndex(x => x.PrescriptionId)
          .HasDatabaseName("ix_prescription_checklist_items_prescription_id");

        builder.HasIndex(x => x.MedicineId)
          .HasFilter("medicine_id IS NOT NULL")
          .HasDatabaseName("ix_prescription_checklist_items_medicine_id");

        builder.HasIndex(x => x.AnalogMedicineId)
          .HasFilter("analog_medicine_id IS NOT NULL")
          .HasDatabaseName("ix_prescription_checklist_items_analog_medicine_id");

        // Filtered index — only paired rows get indexed (most won't). Used
        // for the rare "find dependents of item X" query the service runs
        // when an analog item is being deleted to clear stale references.
        builder.HasIndex(x => x.AnalogItemId)
          .HasFilter("analog_item_id IS NOT NULL")
          .HasDatabaseName("ix_prescription_checklist_items_analog_item_id");
    }
}
