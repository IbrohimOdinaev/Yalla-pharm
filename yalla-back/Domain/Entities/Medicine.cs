using Yalla.Domain.Exceptions;

using Yalla.Domain.ValueObjects;

namespace Yalla.Domain.Entities;

public class Medicine
{
    public Guid Id { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Articul { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public bool IsActive { get; private set; } = true;

    public int? WooCommerceId { get; private set; }

    /// <summary>
    /// URL-friendly slug, sourced from the WooCommerce product `slug` field
    /// (kebab-case latin, e.g. "hichoma-orig-zard-6"). Used for SEO routes
    /// like /product/{slug}. Optional — medicines created via admin without
    /// a WC link won't have one. Unique when present.
    /// </summary>
    public string? Slug { get; private set; }

    public Guid? Id1C { get; private set; }

    public Guid? CategoryId { get; private set; }
    public Category? Category { get; private set; }

    /// <summary>
    /// Shadow medicines materialised from a manual prescription lookup are
    /// flagged as non-catalog (default <c>true</c>). They power per-pharmacy
    /// temp-offers for out-of-catalog prescription items but stay out of
    /// catalog listings, search indexing and medicine pickers.
    /// </summary>
    public bool IsCatalogMedicine { get; private set; } = true;

    /// <summary>FK to <see cref="ManualItemLookupRequest"/> when this row is
    /// a shadow medicine materialised from that lookup. Null for regular
    /// catalog medicines.</summary>
    public Guid? ManualLookupRequestId { get; private set; }

    /// <summary>FK to the specific <see cref="ManualItemLookupResponse"/>
    /// (one-of-N pharmacy answers) this shadow row corresponds to. Null for
    /// regular catalog medicines.</summary>
    public Guid? ManualLookupResponseId { get; private set; }

    private readonly List<Atribute> _atributes = new();

    private readonly List<Offer> _offers = new();
    private readonly List<MedicineImage> _images = new();

    public IReadOnlyCollection<Atribute> Atributes => _atributes.AsReadOnly();

    public IReadOnlyCollection<Offer> Offers => _offers.AsReadOnly();
    public IReadOnlyCollection<MedicineImage> Images => _images.AsReadOnly();


    private Medicine() { }

    public Medicine(string title, string? articul, List<Atribute> atributes)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");

        Id = Guid.NewGuid();
        Title = title;
        Articul = string.IsNullOrWhiteSpace(articul) ? null : articul;
        IsActive = true;
        _atributes.AddRange(atributes);
    }

    public Medicine(
      Guid id,
      string title,
      string? articul,
      List<Atribute> atributes,
      List<Offer> offers,
      List<MedicineImage> images,
      bool isActive = true)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("Medicine.Id can't be empty.");

        if (string.IsNullOrWhiteSpace(title))
            throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");

        if (atributes is null)
            throw new DomainArgumentException("Medicine.Atributes can't be null.");

        if (offers is null)
            throw new DomainArgumentException("Medicine.Offers can't be null.");

        if (images is null)
            throw new DomainArgumentException("Medicine.Images can't be null.");

        Id = id;
        Title = title;
        Articul = string.IsNullOrWhiteSpace(articul) ? null : articul;
        IsActive = isActive;
        _atributes.Clear();
        _atributes.AddRange(atributes);
        _offers.Clear();
        _offers.AddRange(offers);
        _images.Clear();
        _images.AddRange(images);
    }

    public void SetTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");

        Title = title;
    }

    public void SetArticul(string? articul)
    {
        Articul = string.IsNullOrWhiteSpace(articul) ? null : articul;
    }

    public void SetDescription(string description)
    {
        Description = description ?? string.Empty;
    }

    public void SetIsActive(bool isActive)
    {
        IsActive = isActive;
    }

    public void SetWooCommerceId(int? wooCommerceId)
    {
        WooCommerceId = wooCommerceId;
    }

    /// <summary>
    /// Set the URL slug. Empty / whitespace clears it (stored as null).
    /// Trim + lowercase to defend against accidental case mismatches in
    /// downstream lookups; uniqueness is enforced at the DB level.
    /// </summary>
    public void SetSlug(string? slug)
    {
        Slug = string.IsNullOrWhiteSpace(slug) ? null : slug.Trim().ToLowerInvariant();
    }

    public void SetId1C(Guid? id1C)
    {
        Id1C = id1C;
    }

    public void SetCategoryId(Guid? categoryId)
    {
        CategoryId = categoryId;
    }

    public void AddAtribute(Atribute? atribute)
    {
        if (atribute is null)
            throw new DomainArgumentException("Atribute can't be null.");

        _atributes.Add(atribute);
    }

    public void RemoveAtribute(Atribute? atribute)
    {
        if (atribute is null)
            throw new DomainArgumentException("Atribute can't be null.");

        _atributes.Remove(atribute);
    }

    public void AddOffer(Offer? offer)
    {
        if (offer is null)
            throw new DomainArgumentException("Offer can't be null.");

        _offers.Add(offer);
    }

    public void RemoveOffer(Offer? offer)
    {
        if (offer is null)
            throw new DomainArgumentException("Offer can't be null.");

        _offers.Remove(offer);
    }

    public void AddImage(MedicineImage? image)
    {
        if (image is null)
            throw new DomainArgumentException("MedicineImage can't be null.");

        if (image.MedicineId != Id)
            throw new DomainArgumentException("MedicineImage.MedicineId mismatch.");

        if (image.IsMain && _images.Any(x => x.IsMain && x.Id != image.Id))
            throw new DomainArgumentException("Only one main image is allowed for medicine.");

        if (image.IsMinimal && _images.Any(x => x.IsMinimal && x.Id != image.Id))
            throw new DomainArgumentException("Only one minimal image is allowed for medicine.");

        _images.Add(image);
    }

    public void RemoveImage(MedicineImage? image)
    {
        if (image is null)
            throw new DomainArgumentException("MedicineImage can't be null.");

        _images.Remove(image);
    }

    public void UpdateOffers(List<Offer> offers)
    {
        _offers.Clear();
        _offers.AddRange(offers);
    }

    /// <summary>
    /// Build a shadow medicine row that materialises a single pharmacy's
    /// answer to a manual lookup request. The row is intentionally hidden
    /// from the catalog (<see cref="IsCatalogMedicine"/> = false) but acts
    /// as a real Medicine for the order pipeline (pharmacy options,
    /// checkout, OrderPosition). The <paramref name="articul"/> must be
    /// unique across the catalog — caller is expected to use a
    /// well-namespaced value (e.g. <c>manual-{responseId}</c>).
    /// </summary>
    public static Medicine ForManualLookup(
      string title,
      string articul,
      Guid manualLookupRequestId,
      Guid manualLookupResponseId)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");
        if (string.IsNullOrWhiteSpace(articul))
            throw new DomainArgumentException("Medicine.Articul can't be null or whitespace.");
        if (manualLookupRequestId == Guid.Empty)
            throw new DomainArgumentException("ManualLookupRequestId can't be empty.");
        if (manualLookupResponseId == Guid.Empty)
            throw new DomainArgumentException("ManualLookupResponseId can't be empty.");

        return new Medicine
        {
            Id = Guid.NewGuid(),
            Title = title.Trim(),
            Articul = articul.Trim(),
            IsActive = true,
            IsCatalogMedicine = false,
            ManualLookupRequestId = manualLookupRequestId,
            ManualLookupResponseId = manualLookupResponseId
        };
    }
}
