namespace Yalla.Application.DTO.Request;

public sealed class CreateMedicineRequest
{
    public string? Url { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Articul { get; init; }
    public string? Description { get; init; }
    public Guid? CategoryId { get; init; }
    public int? WooCommerceId { get; init; }
    public IReadOnlyCollection<MedicineAtributeRequest> Atributes { get; init; } = [];
}
