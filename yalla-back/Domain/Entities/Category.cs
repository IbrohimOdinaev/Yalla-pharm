using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Category
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public Guid? ParentId { get; private set; }
    public CategoryType? Type { get; private set; }
    public int WooCommerceId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public Category? Parent { get; private set; }

    private readonly List<Category> _children = new();
    public IReadOnlyCollection<Category> Children => _children.AsReadOnly();

    private readonly List<Medicine> _medicines = new();
    public IReadOnlyCollection<Medicine> Medicines => _medicines.AsReadOnly();

    private Category() { }

    public Category(string name, string slug, int wooCommerceId, string description = "",
        Guid? parentId = null, CategoryType? type = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainArgumentException("Category.Name can't be null or whitespace.");

        if (string.IsNullOrWhiteSpace(slug))
            throw new DomainArgumentException("Category.Slug can't be null or whitespace.");

        Id = Guid.NewGuid();
        Name = name;
        Slug = slug;
        WooCommerceId = wooCommerceId;
        Description = description ?? string.Empty;
        ParentId = parentId;
        Type = type;
        IsActive = true;
    }

    public void SetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainArgumentException("Category.Name can't be null or whitespace.");
        Name = name;
    }

    public void SetSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new DomainArgumentException("Category.Slug can't be null or whitespace.");
        Slug = slug;
    }

    public void SetParentId(Guid? parentId)
    {
        ParentId = parentId;
    }

    public void SetType(CategoryType? type)
    {
        Type = type;
    }

    public void SetDescription(string description)
    {
        Description = description ?? string.Empty;
    }

    public void SetIsActive(bool isActive)
    {
        IsActive = isActive;
    }
}
