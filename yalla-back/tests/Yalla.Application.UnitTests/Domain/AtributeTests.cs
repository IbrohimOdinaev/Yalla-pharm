using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.UnitTests.Domain;

public class AtributeTests
{
    [Fact]
    public void Constructor_ValidData_CreatesAtribute()
    {
        var attr = new Atribute(AttributeType.Dosage, "500mg");

        Assert.Equal(AttributeType.Dosage, attr.Type);
        Assert.Equal("500mg", attr.Value);
    }

    [Fact]
    public void Constructor_AllAttributeTypes_Succeed()
    {
        foreach (var type in Enum.GetValues<AttributeType>())
        {
            var attr = new Atribute(type, "test-value");
            Assert.Equal(type, attr.Type);
        }
    }

    [Fact]
    public void Constructor_EmptyValue_Throws()
    {
        Assert.Throws<DomainArgumentException>(() =>
            new Atribute(AttributeType.Manufacturer, ""));
    }

    [Fact]
    public void Constructor_WhitespaceValue_Throws()
    {
        Assert.Throws<DomainArgumentException>(() =>
            new Atribute(AttributeType.Country, "   "));
    }

    [Fact]
    public void Equality_SameTypeAndValue_AreEqual()
    {
        var a = new Atribute(AttributeType.ReleaseForm, "tablet");
        var b = new Atribute(AttributeType.ReleaseForm, "tablet");

        Assert.Equal(a, b);
    }

    [Fact]
    public void Equality_DifferentType_NotEqual()
    {
        var a = new Atribute(AttributeType.Dosage, "500mg");
        var b = new Atribute(AttributeType.Weight, "500mg");

        Assert.NotEqual(a, b);
    }
}
