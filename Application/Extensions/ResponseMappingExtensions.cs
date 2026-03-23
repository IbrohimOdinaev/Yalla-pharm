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

    public static MedicineImageResponse ToResponse(this MedicineImage image)
    {
        return new MedicineImageResponse
        {
            Id = image.Id,
            Key = image.Key,
            IsMain = image.IsMain,
            IsMinimal = image.IsMinimal
        };
    }

    public static MedicineResponse ToResponse(this Medicine medicine)
    {
        return medicine.ToResponse([]);
    }

    public static MedicineResponse ToResponse(
      this Medicine medicine,
      IReadOnlyCollection<MedicineOfferResponse> offers)
    {
        return new MedicineResponse
        {
            Id = medicine.Id,
            Title = medicine.Title,
            Articul = medicine.Articul,
            IsActive = medicine.IsActive,
            Images = medicine.Images.Select(x => x.ToResponse()).ToList(),
            Atributes = medicine.Atributes.Select(x => x.ToResponse()).ToList(),
            Offers = offers
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

    public static BasketPositionResponse ToResponse(this BasketPosition basketPosition)
    {
        return new BasketPositionResponse
        {
            PositionId = basketPosition.Id,
            MedicineId = basketPosition.MedicineId,
            Quantity = basketPosition.Quantity
        };
    }

    public static ClientOrderResponse ToClientOrderResponse(this Order order)
    {
        return new ClientOrderResponse
        {
            OrderId = order.Id,
            PharmacyId = order.PharmacyId,
            OrderPlacedAt = order.OrderPlacedAt,
            IsPickup = order.IsPickup,
            Status = order.Status,
            PaymentState = order.PaymentState,
            PaymentExpiresAtUtc = order.PaymentExpiresAtUtc,
            Cost = order.Cost,
            ReturnCost = order.ReturnCost
        };
    }

    public static ClientResponse ToResponse(
      this Client client,
      IReadOnlyCollection<BasketPositionResponse> basketPositions,
      IReadOnlyCollection<ClientOrderResponse> orders)
    {
        return new ClientResponse
        {
            Id = client.Id,
            Name = client.Name,
            PhoneNumber = client.PhoneNumber,
            BasketPositions = basketPositions,
            Orders = orders,
            PharmacyOptions = []
        };
    }

    public static ClientResponse ToResponse(
      this Client client,
      IReadOnlyCollection<BasketPositionResponse> basketPositions,
      IReadOnlyCollection<ClientOrderResponse> orders,
      IReadOnlyCollection<BasketPharmacyOptionResponse> pharmacyOptions)
    {
        return new ClientResponse
        {
            Id = client.Id,
            Name = client.Name,
            PhoneNumber = client.PhoneNumber,
            BasketPositions = basketPositions,
            Orders = orders,
            PharmacyOptions = pharmacyOptions
        };
    }

    public static CheckoutBasketResponse ToResponse(this Order order, string? paymentUrl = null)
    {
        return new CheckoutBasketResponse
        {
            ClientId = order.ClientId ?? Guid.Empty,
            OrderId = order.Id,
            OrderPlacedAt = order.OrderPlacedAt,
            IsPickup = order.IsPickup,
            DeliveryAddress = order.DeliveryAddress,
            Status = order.Status,
            Cost = order.Cost,
            ReturnCost = order.ReturnCost,
            PaymentState = order.PaymentState,
            PaymentExpiresAtUtc = order.PaymentExpiresAtUtc,
            PaymentUrl = string.IsNullOrWhiteSpace(paymentUrl)
              ? order.PaymentUrl
              : paymentUrl
        };
    }
}
