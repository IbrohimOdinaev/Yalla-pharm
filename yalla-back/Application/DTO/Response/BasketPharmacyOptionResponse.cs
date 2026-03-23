namespace Yalla.Application.DTO.Response;

public sealed class BasketPharmacyOptionResponse
{
    public Guid PharmacyId { get; init; }
    public string PharmacyTitle { get; init; } = string.Empty;
    public bool PharmacyIsActive { get; init; }
    public int FoundMedicinesCount { get; init; }
    public int TotalMedicinesCount { get; init; }
    public string FoundMedicinesRatio { get; init; } = "0/0";
    public int EnoughQuantityMedicinesCount { get; init; }
    public bool IsAvailable { get; init; }
    public decimal TotalCost { get; init; }
    public IReadOnlyCollection<BasketPharmacyItemResponse> Items { get; init; } = [];
}
