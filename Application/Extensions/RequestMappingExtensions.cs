using Yalla.Application.DTO.Request;
using Yalla.Domain.Entities;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.Extensions;

public static class RequestMappingExtensions
{
    public static Medicine ToDomain(this CreateMedicineRequest request)
    {
        var normalizedTitle = request.Title.Trim();
        var normalizedArticul = request.Articul.Trim();

        var atributes = request.Atributes
          .Select(x => new Atribute(x.Name, x.Option))
          .ToList();

        var medicine = new Medicine(normalizedTitle, normalizedArticul, atributes);

        if (!string.IsNullOrWhiteSpace(request.Url))
            medicine.SetUrl(request.Url.Trim());

        return medicine;
    }

    public static Pharmacy ToDomain(this RegisterPharmacyRequest request)
    {
        var pharmacy = new Pharmacy(request.Title, request.Address);
        pharmacy.SetAdminId(request.AdminId);

        return pharmacy;
    }

    public static Client ToDomain(
      this RegisterClientRequest request,
      string normalizedPhoneNumber)
    {
        return new Client(
          request.Name,
          normalizedPhoneNumber);
    }

  public static PharmacyWorker ToDomain(
    this RegisterPharmacyWorkerRequest request,
    Pharmacy pharmacy,
      string normalizedPhoneNumber)
    {
        return new PharmacyWorker(
          request.Name,
          normalizedPhoneNumber,
          request.PharmacyId,
          pharmacy);
    }

    public static void ApplyToDomain(
      this UpdateClientRequest request,
      Client client,
      string normalizedPhoneNumber)
    {
        client.SetName(request.Name);
        client.SetPhoneNumber(normalizedPhoneNumber);
    }

    public static void ApplyToDomain(
      this UpdatePharmacyRequest request,
      Pharmacy pharmacy)
    {
        pharmacy.SetTitle(request.Title);
        pharmacy.SetAddress(request.Address);
        pharmacy.SetAdminId(request.AdminId);

        if (pharmacy.IsActive != request.IsActive)
            pharmacy.ChangeActivity();
    }

    public static void ApplyToDomain(
      this UpdateMedicineRequest request,
      Medicine medicine)
    {
        medicine.SetTitle(request.Title.Trim());
        medicine.SetArticul(request.Articul.Trim());

        if (!string.IsNullOrWhiteSpace(request.Url))
            medicine.SetUrl(request.Url.Trim());
    }

    public static Position ToDomain(
      this AddProductToBasketRequest request,
      Medicine medicine,
      PharmacyOffer liveOffer)
    {
        return new Position(
          orderId: null,
          clientId: request.ClientId,
          pharmacyOffer: liveOffer,
          medicineId: request.MedicineId,
          medicine: medicine,
          quantity: request.Quantity);
    }

    public static Order ToDomain(
      this CheckoutBasketRequest request,
      List<Position> positions)
    {
        return new Order(request.ClientId, request.DeliveryAddress, positions);
    }
}
