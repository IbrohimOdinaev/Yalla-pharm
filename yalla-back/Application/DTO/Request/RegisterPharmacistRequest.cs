namespace Yalla.Application.DTO.Request;

public sealed class RegisterPharmacistRequest
{
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
