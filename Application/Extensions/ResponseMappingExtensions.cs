using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.Extensions;

public static class ResponseMappingExtensions
{
    public static MedicineAtributeResponse ToResponse(this Atribute atribute)
    {
        return new MedicineAtributeResponse
        {
            Name = atribute.Name,
            Option = atribute.Option
        };
    }

    public static MedicineResponse ToResponse(this Medicine medicine)
    {
        return new MedicineResponse
        {
            Id = medicine.Id,
            Url = medicine.Url,
            Title = medicine.Title,
            Articul = medicine.Articul,
            IsActive = medicine.IsActive,
            Atributes = medicine.Atributes.Select(x => x.ToResponse()).ToList()
        };
    }

    public static PharmacyResponse ToResponse(this Pharmacy pharmacy)
    {
        return new PharmacyResponse
        {
            Id = pharmacy.Id,
            Title = pharmacy.Title,
            Address = pharmacy.Address,
            AdminId = pharmacy.AdminId,
            IsActive = pharmacy.IsActive
        };
    }

    public static PharmacyWorkerResponse ToResponse(this PharmacyWorker worker)
    {
        return new PharmacyWorkerResponse
        {
            Id = worker.Id,
            Name = worker.Name,
            PhoneNumber = worker.PhoneNumber,
            PharmacyId = worker.PharmacyId
        };
    }

  public static BasketPositionResponse ToResponse(this Position position)
  {
    return position.ToResponse(position.CapturedOffer.Price);
  }

  public static BasketPositionResponse ToResponse(
    this Position position,
    decimal actualPrice)
  {
    return new BasketPositionResponse
    {
      PositionId = position.Id,
      MedicineId = position.MedicineId,
      PharmacyId = position.CapturedOffer.PharmacyId,
      Quantity = position.Quantity,
      Price = actualPrice
    };
  }

  public static ClientResponse ToResponse(
    this Client client,
    IReadOnlyCollection<BasketPositionResponse> basketPositions)
  {
    return new ClientResponse
    {
      Id = client.Id,
      Name = client.Name,
      PhoneNumber = client.PhoneNumber,
      BasketPositions = basketPositions
    };
  }

  public static CheckoutBasketResponse ToResponse(this Order order)
  {
    return new CheckoutBasketResponse
    {
      ClientId = order.ClientId,
      OrderId = order.Id,
      DeliveryAddress = order.DeliveryAddress,
      Status = order.Status,
      Cost = order.Cost,
      ReturnCost = order.ReturnCost
    };
  }
}
