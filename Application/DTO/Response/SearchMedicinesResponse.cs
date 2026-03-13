namespace Yalla.Application.DTO.Response;

public sealed class SearchMedicinesResponse
{
  public string Query { get; init; } = string.Empty;
  public int Limit { get; init; }
  public IReadOnlyCollection<MedicineSearchItemResponse> Medicines { get; init; } = [];
}
