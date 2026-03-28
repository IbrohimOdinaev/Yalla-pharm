using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.UnitTests.Domain;

public class MedicineCategoryTests
{
    [Fact]
    public void Medicine_SetCategoryId_Works()
    {
        var medicine = new Medicine("Test Medicine", "ART-001",
            [new Atribute(AttributeType.Dosage, "100mg")]);

        var categoryId = Guid.NewGuid();
        medicine.SetCategoryId(categoryId);

        Assert.Equal(categoryId, medicine.CategoryId);
    }

    [Fact]
    public void Medicine_SetCategoryId_Null_ClearsCategory()
    {
        var medicine = new Medicine("Test Medicine", "ART-001",
            [new Atribute(AttributeType.Dosage, "100mg")]);

        medicine.SetCategoryId(Guid.NewGuid());
        medicine.SetCategoryId(null);

        Assert.Null(medicine.CategoryId);
    }

    [Fact]
    public void Medicine_SetWooCommerceId_Works()
    {
        var medicine = new Medicine("Test Medicine", "ART-001",
            [new Atribute(AttributeType.ReleaseForm, "tablet")]);

        medicine.SetWooCommerceId(12345);

        Assert.Equal(12345, medicine.WooCommerceId);
    }

    [Fact]
    public void Medicine_SetWooCommerceId_Null_Clears()
    {
        var medicine = new Medicine("Test Medicine", "ART-001",
            [new Atribute(AttributeType.ReleaseForm, "tablet")]);

        medicine.SetWooCommerceId(12345);
        medicine.SetWooCommerceId(null);

        Assert.Null(medicine.WooCommerceId);
    }

    [Fact]
    public void Medicine_DefaultCategoryId_IsNull()
    {
        var medicine = new Medicine("Test", "ART-002",
            [new Atribute(AttributeType.Manufacturer, "Pfizer")]);

        Assert.Null(medicine.CategoryId);
        Assert.Null(medicine.Category);
        Assert.Null(medicine.WooCommerceId);
    }
}
