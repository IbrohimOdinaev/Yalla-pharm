using Yalla.Domain.Exceptions;

namespace Yalla.Domain.ValueObjects;

public record Atribute
{
  public string Name { get; private set; } = string.Empty;
  public string Option { get; private set; } = string.Empty;

  public Atribute(string name, string option)
  {
    if (string.IsNullOrWhiteSpace(name))
      throw new DomainArgumentException("Atribute.Name can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(option))
      throw new DomainArgumentException("Atribute.Option can't be null or whitespace.");

    Name = name;
    Option = option;
  }
}
