using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.Configurations;

public sealed class OneCImportRunConfiguration : IEntityTypeConfiguration<OneCImportRun>
{
  public void Configure(EntityTypeBuilder<OneCImportRun> builder)
  {
    builder.ToTable("one_c_import_runs");

    builder.HasKey(x => x.Id);

    builder.Property(x => x.Id)
      .HasColumnName("id")
      .HasColumnType("uuid")
      .ValueGeneratedOnAdd()
      .IsRequired();

    builder.Property(x => x.SourceId)
      .HasColumnName("source_id")
      .HasColumnType("uuid")
      .IsRequired();

    builder.Property(x => x.FileKind)
      .HasColumnName("file_kind")
      .HasColumnType("character varying(16)")
      .HasMaxLength(16)
      .IsRequired();

    builder.Property(x => x.FileName)
      .HasColumnName("file_name")
      .HasColumnType("character varying(512)")
      .HasMaxLength(512)
      .IsRequired();

    builder.Property(x => x.FileSize)
      .HasColumnName("file_size")
      .HasColumnType("bigint")
      .IsRequired();

    builder.Property(x => x.FileSignature)
      .HasColumnName("file_signature")
      .HasColumnType("character varying(700)")
      .HasMaxLength(700)
      .IsRequired();

    builder.Property(x => x.Status)
      .HasColumnName("status")
      .HasColumnType("character varying(32)")
      .HasMaxLength(32)
      .IsRequired();

    builder.Property(x => x.ProcessedCount)
      .HasColumnName("processed_count")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.LinkedCount)
      .HasColumnName("linked_count")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.UpdatedCount)
      .HasColumnName("updated_count")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.UnmatchedCount)
      .HasColumnName("unmatched_count")
      .HasColumnType("integer")
      .IsRequired();

    builder.Property(x => x.Error)
      .HasColumnName("error")
      .HasColumnType("text")
      .IsRequired(false);

    builder.Property(x => x.StartedAtUtc)
      .HasColumnName("started_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired();

    builder.Property(x => x.FinishedAtUtc)
      .HasColumnName("finished_at_utc")
      .HasColumnType("timestamp without time zone")
      .IsRequired(false);

    builder.HasIndex(x => new { x.SourceId, x.FileSignature })
      .HasDatabaseName("ix_one_c_import_runs_source_id_file_signature");

    builder.HasIndex(x => new { x.SourceId, x.FileKind, x.StartedAtUtc })
      .HasDatabaseName("ix_one_c_import_runs_source_kind_started");

    builder.HasOne<IntegrationSource>()
      .WithMany()
      .HasForeignKey(x => x.SourceId)
      .OnDelete(DeleteBehavior.Cascade);
  }
}
