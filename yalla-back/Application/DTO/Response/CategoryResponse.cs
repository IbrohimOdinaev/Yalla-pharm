namespace Yalla.Application.DTO.Response;

public sealed class CategoryResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public Guid? ParentId { get; init; }
    public string? Type { get; init; }
    public int WooCommerceId { get; init; }
    public bool IsActive { get; init; }
    public IReadOnlyCollection<CategoryResponse> Children { get; init; } = [];
}
