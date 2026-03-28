using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Domain;

public class CategoryTests
{
    [Fact]
    public void Constructor_ValidData_CreatesCategory()
    {
        var category = new Category("Лекарственные средства", "lekarstva", 3760,
            "Описание", type: CategoryType.Medicines);

        Assert.NotEqual(Guid.Empty, category.Id);
        Assert.Equal("Лекарственные средства", category.Name);
        Assert.Equal("lekarstva", category.Slug);
        Assert.Equal(3760, category.WooCommerceId);
        Assert.Equal("Описание", category.Description);
        Assert.Equal(CategoryType.Medicines, category.Type);
        Assert.Null(category.ParentId);
        Assert.True(category.IsActive);
    }

    [Fact]
    public void Constructor_WithParentId_SetsParent()
    {
        var parentId = Guid.NewGuid();
        var child = new Category("Антибиотики", "antibiotiki", 4368, parentId: parentId);

        Assert.Equal(parentId, child.ParentId);
        Assert.Null(child.Type);
    }

    [Fact]
    public void Constructor_EmptyName_Throws()
    {
        Assert.Throws<DomainArgumentException>(() =>
            new Category("", "slug", 1));
    }

    [Fact]
    public void Constructor_EmptySlug_Throws()
    {
        Assert.Throws<DomainArgumentException>(() =>
            new Category("Name", "", 1));
    }

    [Fact]
    public void SetName_ValidName_Updates()
    {
        var category = new Category("Old", "slug", 1);
        category.SetName("New Name");
        Assert.Equal("New Name", category.Name);
    }

    [Fact]
    public void SetName_Empty_Throws()
    {
        var category = new Category("Old", "slug", 1);
        Assert.Throws<DomainArgumentException>(() => category.SetName(""));
    }

    [Fact]
    public void SetIsActive_ChangesState()
    {
        var category = new Category("Name", "slug", 1);
        Assert.True(category.IsActive);

        category.SetIsActive(false);
        Assert.False(category.IsActive);
    }

    [Fact]
    public void SetParentId_SetsValue()
    {
        var category = new Category("Name", "slug", 1);
        var parentId = Guid.NewGuid();

        category.SetParentId(parentId);
        Assert.Equal(parentId, category.ParentId);

        category.SetParentId(null);
        Assert.Null(category.ParentId);
    }

    [Fact]
    public void SetType_SetsAndClearsValue()
    {
        var category = new Category("Name", "slug", 1);

        category.SetType(CategoryType.Medicines);
        Assert.Equal(CategoryType.Medicines, category.Type);

        category.SetType(null);
        Assert.Null(category.Type);
    }
}
