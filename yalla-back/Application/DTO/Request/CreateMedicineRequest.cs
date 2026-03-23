namespace Yalla.Application.DTO.Request;

public sealed class CreateMedicineRequest
{
    public string? Url { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Articul { get; init; } = string.Empty;
    public IReadOnlyCollection<MedicineAtributeRequest> Atributes { get; init; } = [];
}
