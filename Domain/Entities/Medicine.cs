using Yalla.Domain.Exceptions;

using Yalla.Domain.ValueObjects;

namespace Yalla.Domain.Entities;

public class Medicine
{
  public Guid Id { get; private set; }

  public string? Url { get; private set; }

  public string Title { get; private set; } = string.Empty;

  public string Articul { get; private set; } = string.Empty;


  private readonly List<Atribute> _atributes = new();

  private readonly List<Offer> _offers = new();

  public IReadOnlyCollection<Atribute> Atributes => _atributes.AsReadOnly();

  public IReadOnlyCollection<Offer> Offers => _offers.AsReadOnly();


  private Medicine() { }

  public Medicine(string title, string articul, List<Atribute> atributes)
  {
    if (string.IsNullOrWhiteSpace(title))
      throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(articul))
      throw new DomainArgumentException("Medicine.Articul can't be null or whitespace.");

    Id = Guid.NewGuid();
    Title = title;
    Articul = articul;
    _atributes.AddRange(atributes);
  }

  public Medicine(Guid id, string? url, string title, string articul, List<Atribute> atributes, List<Offer> offers)
  {
    Id = id;
    Url = url;
    Title = title;
    Articul = articul;
    _atributes = atributes;
    _offers.AddRange(offers);
  }

  public void SetUrl(string? url)
  {
    if (string.IsNullOrWhiteSpace(url))
      throw new DomainArgumentException("Medicine.Url can't be null or whitespace.");

    Url = url;
  }

  public void SetTitle(string title)
  {
    if (string.IsNullOrWhiteSpace(title))
      throw new DomainArgumentException("Medicine.Title can't be null or whitespace.");

    Title = title;
  }

  public void SetArticul(string articul)
  {
    if (string.IsNullOrWhiteSpace(articul))
      throw new DomainArgumentException("Medicine.Articul can't be null or whitespace.");

    Articul = articul;
  }

  public void AddAtribute(Atribute? atribute)
  {
    if (atribute is null)
      throw new DomainArgumentException("Atribute can't be null.");

    _atributes.Add(atribute);
  }

  public void RemoveAtribute(Atribute? atribute)
  {
    if (atribute is null)
      throw new DomainArgumentException("Atribute can't be null.");

    _atributes.Remove(atribute);
  }

  public void AddOffer(Offer? offer)
  {
    if (offer is null)
      throw new DomainArgumentException("Offer can't be null.");

    _offers.Add(offer);
  }

  public void RemoveOffer(Offer? offer)
  {
    if (offer is null)
      throw new DomainArgumentException("Offer can't be null.");

    _offers.Remove(offer);
  }

  public void UpdateOffers(List<Offer> offers)
  {
    _offers.Clear();
    _offers.AddRange(offers);
  }
}
