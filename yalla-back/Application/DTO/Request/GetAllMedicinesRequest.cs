namespace Yalla.Application.DTO.Request;

public sealed class GetAllMedicinesRequest
{
  public string Query { get; init; } = string.Empty;
  public bool? IsActive { get; init; }
  public Guid? CategoryId { get; init; }
  public int Page { get; init; } = 1;
  public int PageSize { get; init; } = 50;
}
