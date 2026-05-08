namespace Yalla.Application.DTO.Response;

public sealed class RegisterPharmacistResponse
{
    public Guid PharmacistId { get; set; }
}

public sealed class PharmacistResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
}
