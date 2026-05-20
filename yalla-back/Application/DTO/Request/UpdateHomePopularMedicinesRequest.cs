namespace Yalla.Application.DTO.Request;

public sealed class UpdateHomePopularMedicinesRequest
{
  public IReadOnlyCollection<Guid> MedicineIds { get; init; } = [];
}
