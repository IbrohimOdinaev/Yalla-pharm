using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class Pharmacy
{
    public Guid Id { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Address { get; private set; } = string.Empty;

    public Guid AdminId { get; private set; } = Guid.Empty;

    public bool IsActive { get; private set; } = true;

    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }

    public string? IconUrl { get; private set; }

    public string? BannerUrl { get; private set; }

    private readonly List<Order> _orders = new();
    public IReadOnlyCollection<Order> Orders => _orders.AsReadOnly();

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
        if (id == Guid.Empty)
            throw new DomainArgumentException("Id can't be empty.");

        if (string.IsNullOrWhiteSpace(title))
            throw new DomainArgumentException("Pharmacy.Title can't be null or whitespace.");

        if (string.IsNullOrWhiteSpace(address))
            throw new DomainArgumentException("Pharmacy.Address can't be null or whitespace.");

        if (adminId == Guid.Empty)
            throw new DomainArgumentException("AdminId can't be empty.");

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

    public void SetCoordinates(double? latitude, double? longitude)
    {
        Latitude = latitude;
        Longitude = longitude;
    }

    public void SetIconUrl(string? iconUrl)
    {
        IconUrl = string.IsNullOrWhiteSpace(iconUrl) ? null : iconUrl.Trim();
    }

    public void SetBannerUrl(string? bannerUrl)
    {
        BannerUrl = string.IsNullOrWhiteSpace(bannerUrl) ? null : bannerUrl.Trim();
    }

    public void ChangeActivity()
    {
        IsActive = !IsActive;
    }

    public void AddOrder(Order? order)
    {
        if (order is null) throw new DomainArgumentException("Cannot add null Order.");

        _orders.Add(order);
    }

    public void RemoveOrder(Order? order)
    {
        if (order is null) throw new DomainArgumentException("Cannot remove null Order.");

        _orders.Remove(order);
    }
}
