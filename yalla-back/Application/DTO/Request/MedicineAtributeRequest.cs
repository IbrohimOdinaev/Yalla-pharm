using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class MedicineAtributeRequest
{
  public AttributeType Type { get; init; }
  public string Value { get; init; } = string.Empty;
}
