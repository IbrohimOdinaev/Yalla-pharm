namespace Yalla.Application.DTO.Request;

public sealed class SearchMedicinesRequest
{
  public string Query { get; init; } = string.Empty;
  public int Limit { get; init; } = 20;
}
