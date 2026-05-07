using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// One photo of a doctor's prescription, stored in MinIO under a key like
/// `prescriptions/yyyy/MM/dd/{guid}{ext}`. Up to <see cref="Prescription.MaxImagesPerPrescription"/>
/// per prescription, ordered by <see cref="OrderIndex"/>.
/// </summary>
public class PrescriptionImage
{
    public Guid Id { get; private set; }

    public Guid PrescriptionId { get; private set; }

    /// <summary>MinIO object key (without bucket prefix).</summary>
    public string Key { get; private set; } = string.Empty;

    /// <summary>Zero-based ordering within the prescription (0 or 1).</summary>
    public int OrderIndex { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    private PrescriptionImage() { }

    public PrescriptionImage(string key, int orderIndex)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new DomainArgumentException("PrescriptionImage.Key can't be empty.");

        if (orderIndex < 0 || orderIndex >= Prescription.MaxImagesPerPrescription)
            throw new DomainArgumentException(
              $"PrescriptionImage.OrderIndex must be in [0, {Prescription.MaxImagesPerPrescription - 1}].");

        Id = Guid.NewGuid();
        Key = key;
        OrderIndex = orderIndex;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
