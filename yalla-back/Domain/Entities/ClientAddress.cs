using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// Saved address on a client profile. Two kinds in one table:
///  - "named" entries (<see cref="Title"/> is set) — explicitly saved by client with a name like "Дом";
///  - "history" entries (<see cref="Title"/> is null) — automatically recorded when the client uses
///    an address at checkout. History is deduplicated by address text.
/// </summary>
public class ClientAddress
{
  public const int MaxAddressLength = 500;
  public const int MaxTitleLength = 64;

  public Guid Id { get; private set; }
  public Guid ClientId { get; private set; }
  public string Address { get; private set; } = string.Empty;
  public string? Title { get; private set; }
  public double Latitude { get; private set; }
  public double Longitude { get; private set; }
  public DateTime LastUsedAtUtc { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }

  private ClientAddress() { }

  public ClientAddress(Guid clientId, string address, double latitude, double longitude, string? title = null)
  {
    if (clientId == Guid.Empty)
      throw new DomainArgumentException("ClientAddress.ClientId can't be empty.");

    Id = Guid.NewGuid();
    ClientId = clientId;
    Address = NormalizeAddress(address);
    Title = NormalizeTitle(title);
    Latitude = latitude;
    Longitude = longitude;
    CreatedAtUtc = DateTime.UtcNow;
    LastUsedAtUtc = CreatedAtUtc;
  }

  public void SetTitle(string? title) => Title = NormalizeTitle(title);

  public void SetAddress(string address) => Address = NormalizeAddress(address);

  public void SetCoordinates(double latitude, double longitude)
  {
    Latitude = latitude;
    Longitude = longitude;
  }

  public void TouchLastUsed() => LastUsedAtUtc = DateTime.UtcNow;

  private static string NormalizeAddress(string address)
  {
    if (string.IsNullOrWhiteSpace(address))
      throw new DomainArgumentException("ClientAddress.Address can't be null or whitespace.");

    var trimmed = address.Trim();
    if (trimmed.Length > MaxAddressLength)
      throw new DomainArgumentException($"ClientAddress.Address length can't exceed {MaxAddressLength}.");

    return trimmed;
  }

  private static string? NormalizeTitle(string? title)
  {
    if (string.IsNullOrWhiteSpace(title))
      return null;

    var trimmed = title.Trim();
    if (trimmed.Length > MaxTitleLength)
      throw new DomainArgumentException($"ClientAddress.Title length can't exceed {MaxTitleLength}.");

    return trimmed;
  }
}
