using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Domain.Entities;
using Yalla.Domain.Exceptions;
using Yalla.Domain.ValueObjects;

namespace Yalla.Application.Extensions;

public static class RequestMappingExtensions
{
    public static Medicine ToDomain(this CreateMedicineRequest request)
    {
        var normalizedTitle = request.Title.Trim();
        var normalizedArticul = request.Articul?.Trim();

        var atributes = request.Atributes
          .Select(x => new Atribute(x.Type, x.Value))
          .ToList();

        var medicine = new Medicine(normalizedTitle, normalizedArticul, atributes);

        if (!string.IsNullOrEmpty(request.Description))
            medicine.SetDescription(request.Description);

        if (request.CategoryId.HasValue)
            medicine.SetCategoryId(request.CategoryId.Value);

        if (request.WooCommerceId.HasValue)
            medicine.SetWooCommerceId(request.WooCommerceId.Value);

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
      string normalizedPhoneNumber,
      string passwordHash)
    {
        return new Client(
          request.Name,
          normalizedPhoneNumber,
          passwordHash);
    }

    public static PharmacyWorker ToDomain(
      this RegisterPharmacyWorkerRequest request,
      Pharmacy pharmacy,
      string normalizedPhoneNumber,
      string passwordHash)
    {
        return new PharmacyWorker(
          request.Name,
          normalizedPhoneNumber,
          passwordHash,
          request.PharmacyId,
          pharmacy);
    }

    public static void ApplyToDomain(
      this UpdateClientRequest request,
      Client client,
      string normalizedPhoneNumber)
    {
        if (request.Name != null)
            client.SetName(request.Name);
        if (!string.IsNullOrWhiteSpace(normalizedPhoneNumber))
            client.SetPhoneNumber(normalizedPhoneNumber);
        if (request.Gender.HasValue)
            client.SetGender((Domain.Enums.Gender)request.Gender.Value);
        if (request.DateOfBirth != null && DateOnly.TryParse(request.DateOfBirth, out var dob))
            client.SetDateOfBirth(dob);
    }

    public static void ApplyToDomain(
      this UpdatePharmacyRequest request,
      Pharmacy pharmacy)
    {
        pharmacy.SetTitle(request.Title);
        pharmacy.SetAddress(request.Address);
        pharmacy.SetAdminId(request.AdminId);
        pharmacy.SetCoordinates(request.Latitude, request.Longitude);

        if (pharmacy.IsActive != request.IsActive)
            pharmacy.ChangeActivity();
    }

    public static void ApplyToDomain(
      this UpdateMedicineRequest request,
      Medicine medicine)
    {
        medicine.SetTitle(request.Title.Trim());
        medicine.SetArticul(request.Articul?.Trim());
        medicine.SetCategoryId(request.CategoryId);

    }

    public static BasketPosition ToDomain(
      this AddProductToBasketRequest request,
      Medicine medicine)
    {
        return new BasketPosition(
          clientId: request.ClientId,
          medicineId: request.MedicineId,
          medicine: medicine,
          quantity: request.Quantity);
    }

    public static Order ToDomain(
      this CheckoutBasketRequest request,
      Guid orderId,
      string clientPhoneNumber,
      List<OrderPosition> positions)
    {
        return new Order(
          orderId,
          request.ClientId,
          clientPhoneNumber,
          request.PharmacyId,
          request.DeliveryAddress,
          positions,
          request.IdempotencyKey,
          isPickup: request.IsPickup);
    }

    public static async Task<Client> GetTrackedClientOrThrowAsync(
      this IAppDbContext dbContext,
      Guid clientId,
      CancellationToken cancellationToken = default)
    {
        var local = dbContext.Clients.Local.FirstOrDefault(x => x.Id == clientId);
        if (local is not null)
            return local;

        return await dbContext.Clients
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == clientId, cancellationToken)
          ?? throw new InvalidOperationException($"Client with id '{clientId}' was not found.");
    }

    public static async Task<Medicine> GetTrackedMedicineOrThrowAsync(
      this IAppDbContext dbContext,
      Guid medicineId,
      CancellationToken cancellationToken = default)
    {
        var local = dbContext.Medicines.Local.FirstOrDefault(x => x.Id == medicineId);
        if (local is not null)
            return local;

        return await dbContext.Medicines
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == medicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{medicineId}' was not found.");
    }

    public static async Task<Pharmacy> GetTrackedPharmacyOrThrowAsync(
      this IAppDbContext dbContext,
      Guid pharmacyId,
      CancellationToken cancellationToken = default)
    {
        var local = dbContext.Pharmacies.Local.FirstOrDefault(x => x.Id == pharmacyId);
        if (local is not null)
            return local;

        return await dbContext.Pharmacies
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == pharmacyId, cancellationToken)
          ?? throw new InvalidOperationException($"Pharmacy with id '{pharmacyId}' was not found.");
    }

}
