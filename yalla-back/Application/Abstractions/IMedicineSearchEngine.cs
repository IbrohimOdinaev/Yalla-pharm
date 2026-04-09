namespace Yalla.Application.Abstractions;

public sealed class MedicineSearchDocument
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Articul { get; init; } = string.Empty;
    public string? CategoryName { get; init; }
    public string? Description { get; init; }
    public decimal? MinPrice { get; init; }
    public bool IsActive { get; init; }
    public bool HasStock { get; init; }
}

public sealed class MedicineSearchResult
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Articul { get; init; } = string.Empty;
    public string? CategoryName { get; init; }
    public decimal? MinPrice { get; init; }
    public double Score { get; init; }
}

public interface IMedicineSearchEngine
{
    Task IndexMedicineAsync(MedicineSearchDocument doc, CancellationToken ct = default);
    Task IndexManyAsync(IEnumerable<MedicineSearchDocument> docs, CancellationToken ct = default);
    Task DeleteAsync(Guid medicineId, CancellationToken ct = default);
    Task<IReadOnlyList<MedicineSearchResult>> SearchAsync(string query, int limit = 20, CancellationToken ct = default);
    Task ReindexAllAsync(CancellationToken ct = default);
}
