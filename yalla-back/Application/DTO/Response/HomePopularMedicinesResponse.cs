namespace Yalla.Application.DTO.Response;

public sealed class HomePopularMedicinesResponse
{
  public IReadOnlyCollection<HomePopularMedicineItemResponse> Items { get; init; } = [];
}
