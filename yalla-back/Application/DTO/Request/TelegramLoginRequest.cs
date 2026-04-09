namespace Yalla.Application.DTO.Request;

public sealed class TelegramLoginRequest
{
    public long Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string? LastName { get; init; }
    public string? Username { get; init; }
    public string? PhotoUrl { get; init; }
    public long AuthDate { get; init; }
    public string Hash { get; init; } = string.Empty;
}
