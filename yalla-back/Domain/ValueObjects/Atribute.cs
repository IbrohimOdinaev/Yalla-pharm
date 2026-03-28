using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.ValueObjects;

public record Atribute
{
  public AttributeType Type { get; private set; }
  public string Value { get; private set; } = string.Empty;

  public Atribute(AttributeType type, string value)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException("Atribute.Value can't be null or whitespace.");

    Type = type;
    Value = value;
  }
}
