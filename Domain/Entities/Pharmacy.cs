using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Pharmacy
{
  public Guid Id { get; private set; }

  public string Title { get; private set; } = string.Empty;

  public string Address { get; private set; } = string.Empty;

  public Guid AdminId { get; private set; }

  public bool IsActive { get; private set; } = true;

  private readonly List<Offer> _offers = new();
  public IReadOnlyCollection<Offer> Offers => _offers.AsReadOnly();


  private Pharmacy() { }

  public Pharmacy(string title, string address)
  {
    if (string.IsNullOrWhiteSpace(title))
      throw new DomainArgumentException("Pharmacy.Title can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(address))
      throw new DomainArgumentException("Pharmacy.Address can't be null or whitespace.");

    Id = Guid.NewGuid();
    Title = title;
    Address = address;
  }

  public Pharmacy(Guid id, string title, string address, Guid adminId, bool isActive)
  {
    Id = id;
    Title = title;
    Address = address;
    AdminId = adminId;
    IsActive = isActive;
  }

  public void SetTitle(string title)
  {
    if (string.IsNullOrWhiteSpace(title))
      throw new DomainArgumentException("Pharmacy.Title can't be null or whitespace.");

    Title = title;
  }

  public void SetAddress(string address)
  {
    if (string.IsNullOrWhiteSpace(address))
      throw new DomainArgumentException("Pharmacy.Address can't be null or whitespace.");

    Address = address;
  }

  public void SetAdminId(Guid adminId)
  {
    if (adminId == Guid.Empty)
      throw new DomainArgumentException("AdminId can't be empty.");

    AdminId = adminId;
  }

  public void ChangeActivity()
  {
    IsActive = !IsActive;
  }

  public void AddOffer(Offer offer)
  {
    if (offer is null)
      throw new DomainArgumentException("Offer can't be null.");

    _offers.Add(offer);
  }

  public void RemoveOffer(Offer offer)
  {
    if (offer is null)
      throw new DomainArgumentException("Offer can't be null.");

    _offers.Remove(offer);
  }
}
