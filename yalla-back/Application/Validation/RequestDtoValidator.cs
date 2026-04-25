using Yalla.Application.DTO.Request;
using Yalla.Application.Common;

namespace Yalla.Application.Validation;

public static class RequestDtoValidator
{
  private const int MedicineTitleMaxLength = 256;
  private const int MedicineArticulMaxLength = 128;
  private const int MedicineAttributeNameMaxLength = 200;
  private const int MedicineAttributeOptionMaxLength = 500;

  public static IReadOnlyCollection<ValidationError> Validate(object dto)
  {
    var errors = new List<ValidationError>();

    switch (dto)
    {
      case AddProductToBasketRequest request:
        ValidateAddProductToBasket(request, errors);
        break;
      case CancelOrderRequest request:
        ValidateCancelOrder(request, errors);
        break;
      case ChangePasswordRequest request:
        ValidateChangePassword(request, errors);
        break;
      case CheckoutBasketRequest request:
        ValidateCheckoutBasket(request, errors);
        break;
      case ClearBasketRequest:
        break;
      case CreateMedicineRequest request:
        ValidateCreateMedicine(request, errors);
        break;
      case CreateMedicineImageRequest request:
        ValidateCreateMedicineImage(request, errors);
        break;
      case DeleteClientRequest request:
        RequireNotEmpty(request.ClientId, nameof(request.ClientId), errors);
        break;
      case DeleteMedicineImageRequest request:
        ValidateDeleteMedicineImage(request, errors);
        break;
      case DeleteMedicineRequest request:
        RequireNotEmpty(request.MedicineId, nameof(request.MedicineId), errors);
        break;
      case DeleteNewOrderByAdminRequest request:
        RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
        break;
      case DeletePharmacyRequest request:
        RequireNotEmpty(request.PharmacyId, nameof(request.PharmacyId), errors);
        break;
      case DeletePharmacyWorkerRequest request:
        RequireNotEmpty(request.PharmacyWorkerId, nameof(request.PharmacyWorkerId), errors);
        break;
      case GetAllClientsRequest request:
        ValidateGetAllClients(request, errors);
        break;
      case GetAdminsRequest request:
        ValidateGetAdmins(request, errors);
        break;
      case GetAllOrdersRequest request:
        ValidateGetAllOrders(request, errors);
        break;
      case GetClientByPhoneNumberRequest request:
        ValidateGetClientByPhoneNumber(request, errors);
        break;
      case GetClientOrderHistoryRequest:
        break;
      case GetMedicinesCatalogRequest request:
        ValidateGetMedicinesCatalog(request, errors);
        break;
      case GetNewOrdersForWorkerRequest request:
        ValidateGetNewOrdersForWorker(request, errors);
        break;
      case GetRefundRequestsRequest request:
        ValidateGetRefundRequests(request, errors);
        break;
      case InitiateRefundBySuperAdminRequest request:
        RequireNotEmpty(request.RefundRequestId, nameof(request.RefundRequestId), errors);
        break;
      case LoginRequest request:
        ValidateLogin(request, errors);
        break;
      case MarkOrderDeliveredBySuperAdminRequest request:
        RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
        break;
      case MarkOrderOnTheWayRequest request:
        RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
        break;
      case MarkOrderReadyRequest request:
        RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
        break;
      case PayForOrderRequest request:
        ValidatePayForOrder(request, errors);
        break;
      case RegisterClientRequest request:
        ValidateRegisterClient(request, errors);
        break;
      case RegisterAdminWithPharmacyRequest request:
        ValidateRegisterAdminWithPharmacy(request, errors);
        break;
      case RegisterPharmacyRequest request:
        ValidateRegisterPharmacy(request, errors);
        break;
      case RegisterPharmacyWorkerRequest request:
        ValidateRegisterPharmacyWorker(request, errors);
        break;
      case VerifyClientRegistrationRequest request:
        ValidateVerifyClientRegistration(request, errors);
        break;
      case ResendClientRegistrationRequest request:
        RequireNotEmpty(request.RegistrationId, nameof(request.RegistrationId), errors);
        break;
      case RejectOrderPositionsRequest request:
        ValidateRejectOrderPositions(request, errors);
        break;
      case RemoveProductFromBasketRequest request:
        RequireNotEmpty(request.PositionId, nameof(request.PositionId), errors);
        break;
      case SearchMedicinesRequest request:
        ValidateSearchMedicines(request, errors);
        break;
      case StartOrderAssemblyRequest request:
        RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
        break;
      case UpdateAdminProfileRequest request:
        ValidateUpdateAdminProfile(request, errors);
        break;
      case UpdateBasketPositionQuantityRequest request:
        ValidateUpdateBasketPositionQuantity(request, errors);
        break;
      case UpdateClientRequest request:
        ValidateUpdateClient(request, errors);
        break;
      case UpdateMyClientProfileRequest request:
        ValidateUpdateMyClientProfile(request, errors);
        break;
      case UpdateMedicineRequest request:
        ValidateUpdateMedicine(request, errors);
        break;
      case UpdatePharmacyRequest request:
        ValidateUpdatePharmacy(request, errors);
        break;
    }

    return errors;
  }

  private static void ValidateAddProductToBasket(
    AddProductToBasketRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.MedicineId, nameof(request.MedicineId), errors);
    RequireGreaterThanZero(request.Quantity, nameof(request.Quantity), errors);
  }

  private static void ValidateCancelOrder(
    CancelOrderRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
  }

  private static void ValidateChangePassword(
    ChangePasswordRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.CurrentPassword, nameof(request.CurrentPassword), errors);
    RequirePasswordByPolicy(request.NewPassword, nameof(request.NewPassword), errors);
  }

  private static void ValidateCheckoutBasket(
    CheckoutBasketRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.PharmacyId, nameof(request.PharmacyId), errors);
    if (!request.IsPickup)
      RequireNotWhiteSpace(request.DeliveryAddress, nameof(request.DeliveryAddress), errors);
    RequireNoEmptyGuids(request.IgnoredPositionIds, nameof(request.IgnoredPositionIds), errors);
  }

  private static void ValidateCreateMedicine(
    CreateMedicineRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.Title, nameof(request.Title), errors);
    RequireMaxLength(request.Title, nameof(request.Title), MedicineTitleMaxLength, errors);
    if (!string.IsNullOrWhiteSpace(request.Articul))
      RequireMaxLength(request.Articul, nameof(request.Articul), MedicineArticulMaxLength, errors);

    if (request.Atributes is null)
    {
      errors.Add(new ValidationError(nameof(request.Atributes), "Atributes can't be null."));
      return;
    }

    var index = 0;
    foreach (var attribute in request.Atributes)
    {
      if (attribute is null)
      {
        errors.Add(new ValidationError($"{nameof(request.Atributes)}[{index}]", "Atribute can't be null."));
        index++;
        continue;
      }

      if (!Enum.IsDefined(attribute.Type))
        errors.Add(new ValidationError($"{nameof(request.Atributes)}[{index}].{nameof(attribute.Type)}", "Invalid attribute type."));
      RequireNotWhiteSpace(attribute.Value, $"{nameof(request.Atributes)}[{index}].{nameof(attribute.Value)}", errors);
      RequireMaxLength(
        attribute.Value,
        $"{nameof(request.Atributes)}[{index}].{nameof(attribute.Value)}",
        MedicineAttributeOptionMaxLength,
        errors);
      index++;
    }
  }

  private static void ValidateCreateMedicineImage(
    CreateMedicineImageRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.MedicineId, nameof(request.MedicineId), errors);

    if (request.IsMain is null)
      errors.Add(new ValidationError(nameof(request.IsMain), $"{nameof(request.IsMain)} is required."));

    if (request.IsMinimal is null)
      errors.Add(new ValidationError(nameof(request.IsMinimal), $"{nameof(request.IsMinimal)} is required."));
  }

  private static void ValidateDeleteMedicineImage(
    DeleteMedicineImageRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.MedicineId, nameof(request.MedicineId), errors);
    RequireNotEmpty(request.MedicineImageId, nameof(request.MedicineImageId), errors);
  }

  private static void ValidateGetAllClients(
    GetAllClientsRequest request,
    List<ValidationError> errors)
  {
    if (request.Page < 1)
      errors.Add(new ValidationError(nameof(request.Page), "Page must be greater than zero."));

    if (request.PageSize < 1)
      errors.Add(new ValidationError(nameof(request.PageSize), "PageSize must be greater than zero."));
  }

  private static void ValidateGetAdmins(
    GetAdminsRequest request,
    List<ValidationError> errors)
  {
    if (request.Page < 1)
      errors.Add(new ValidationError(nameof(request.Page), "Page must be greater than zero."));

    if (request.PageSize < 1)
      errors.Add(new ValidationError(nameof(request.PageSize), "PageSize must be greater than zero."));
  }

  private static void ValidateGetAllOrders(
    GetAllOrdersRequest request,
    List<ValidationError> errors)
  {
    if (request.Page < 1)
      errors.Add(new ValidationError(nameof(request.Page), "Page must be greater than zero."));

    if (request.PageSize < 1)
      errors.Add(new ValidationError(nameof(request.PageSize), "PageSize must be greater than zero."));
  }

  private static void ValidateGetClientByPhoneNumber(
    GetClientByPhoneNumberRequest request,
    List<ValidationError> errors)
  {
    RequireDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
  }

  private static void ValidateGetNewOrdersForWorker(
    GetNewOrdersForWorkerRequest request,
    List<ValidationError> errors)
  {
    if (request.Take < 1)
      errors.Add(new ValidationError(nameof(request.Take), "Take must be greater than zero."));
  }

  private static void ValidateGetMedicinesCatalog(
    GetMedicinesCatalogRequest request,
    List<ValidationError> errors)
  {
    if (request.Page < 1)
      errors.Add(new ValidationError(nameof(request.Page), "Page must be greater than zero."));

    if (request.PageSize < 1)
      errors.Add(new ValidationError(nameof(request.PageSize), "PageSize must be greater than zero."));
  }

  private static void ValidateGetRefundRequests(
    GetRefundRequestsRequest request,
    List<ValidationError> errors)
  {
    if (request.Page < 1)
      errors.Add(new ValidationError(nameof(request.Page), "Page must be greater than zero."));

    if (request.PageSize < 1)
      errors.Add(new ValidationError(nameof(request.PageSize), "PageSize must be greater than zero."));
  }

  private static void ValidateLogin(
    LoginRequest request,
    List<ValidationError> errors)
  {
    RequireDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
    RequireNotWhiteSpace(request.Password, nameof(request.Password), errors);
  }

  private static void ValidatePayForOrder(
    PayForOrderRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);
    RequireNotEmpty(request.ClientId, nameof(request.ClientId), errors);
    RequireNotEmpty(request.PharmacyId, nameof(request.PharmacyId), errors);
    RequireGreaterThanZero(request.Amount, nameof(request.Amount), errors);
    RequireNotWhiteSpace(request.Currency, nameof(request.Currency), errors);
  }

  private static void ValidateRegisterClient(
    RegisterClientRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.Name, nameof(request.Name), errors);
    RequireDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
    RequirePasswordByPolicy(request.Password, nameof(request.Password), errors);
  }

  private static void ValidateRegisterAdminWithPharmacy(
    RegisterAdminWithPharmacyRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.AdminName, nameof(request.AdminName), errors);
    RequireDigitsPhone(request.AdminPhoneNumber, nameof(request.AdminPhoneNumber), errors);
    RequirePasswordByPolicy(request.AdminPassword, nameof(request.AdminPassword), errors);
    RequireNotWhiteSpace(request.PharmacyTitle, nameof(request.PharmacyTitle), errors);
    RequireNotWhiteSpace(request.PharmacyAddress, nameof(request.PharmacyAddress), errors);
  }

  private static void ValidateRegisterPharmacy(
    RegisterPharmacyRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.Title, nameof(request.Title), errors);
    RequireNotWhiteSpace(request.Address, nameof(request.Address), errors);
    RequireNotEmpty(request.AdminId, nameof(request.AdminId), errors);
  }

  private static void ValidateRegisterPharmacyWorker(
    RegisterPharmacyWorkerRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.Name, nameof(request.Name), errors);
    RequireDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
    RequirePasswordByPolicy(request.Password, nameof(request.Password), errors);
    RequireNotEmpty(request.PharmacyId, nameof(request.PharmacyId), errors);
  }

  private static void ValidateVerifyClientRegistration(
    VerifyClientRegistrationRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.RegistrationId, nameof(request.RegistrationId), errors);
    RequireNotWhiteSpace(request.Code, nameof(request.Code), errors);

    var code = request.Code?.Trim() ?? string.Empty;
    if (code.Length > 0 && (code.Length != 6 || !code.All(char.IsDigit)))
    {
      errors.Add(new ValidationError(nameof(request.Code), "Code must contain exactly 6 digits."));
    }
  }

  private static void ValidateRejectOrderPositions(
    RejectOrderPositionsRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.OrderId, nameof(request.OrderId), errors);

    if (request.PositionIds is null || request.PositionIds.Count == 0)
      errors.Add(new ValidationError(nameof(request.PositionIds), "At least one position id must be provided."));
    else
      RequireNoEmptyGuids(request.PositionIds, nameof(request.PositionIds), errors);
  }

  private static void ValidateSearchMedicines(
    SearchMedicinesRequest request,
    List<ValidationError> errors)
  {
    if (request.Limit < 1)
      errors.Add(new ValidationError(nameof(request.Limit), "Limit must be greater than zero."));
  }

  private static void ValidateUpdateAdminProfile(
    UpdateAdminProfileRequest request,
    List<ValidationError> errors)
  {
    RequireNotWhiteSpace(request.Name, nameof(request.Name), errors);
    RequireDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
  }

  private static void ValidateUpdateBasketPositionQuantity(
    UpdateBasketPositionQuantityRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.PositionId, nameof(request.PositionId), errors);
    RequireGreaterThanZero(request.Quantity, nameof(request.Quantity), errors);
  }

  private static void ValidateUpdateClient(
    UpdateClientRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.ClientId, nameof(request.ClientId), errors);
    // Partial update: only validate fields the caller actually sent.
    RequireOptionalNotWhiteSpace(request.Name, nameof(request.Name), errors);
    RequireOptionalDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
  }

  private static void ValidateUpdateMyClientProfile(
    UpdateMyClientProfileRequest request,
    List<ValidationError> errors)
  {
    // Partial update: only validate fields the caller actually sent.
    RequireOptionalNotWhiteSpace(request.Name, nameof(request.Name), errors);
    RequireOptionalDigitsPhone(request.PhoneNumber, nameof(request.PhoneNumber), errors);
  }

  private static void ValidateUpdateMedicine(
    UpdateMedicineRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.MedicineId, nameof(request.MedicineId), errors);
    RequireNotWhiteSpace(request.Title, nameof(request.Title), errors);
    RequireMaxLength(request.Title, nameof(request.Title), MedicineTitleMaxLength, errors);
    if (!string.IsNullOrWhiteSpace(request.Articul))
      RequireMaxLength(request.Articul, nameof(request.Articul), MedicineArticulMaxLength, errors);
  }

  private static void ValidateUpdatePharmacy(
    UpdatePharmacyRequest request,
    List<ValidationError> errors)
  {
    RequireNotEmpty(request.PharmacyId, nameof(request.PharmacyId), errors);
    RequireNotWhiteSpace(request.Title, nameof(request.Title), errors);
    RequireNotWhiteSpace(request.Address, nameof(request.Address), errors);
    if (request.AdminId.HasValue)
      RequireNotEmpty(request.AdminId.Value, nameof(request.AdminId), errors);
  }

  private static void RequireNotEmpty(Guid value, string field, List<ValidationError> errors)
  {
    if (value == Guid.Empty)
      errors.Add(new ValidationError(field, $"{field} can't be empty."));
  }

  private static void RequireNotWhiteSpace(string? value, string field, List<ValidationError> errors)
  {
    if (string.IsNullOrWhiteSpace(value))
      errors.Add(new ValidationError(field, $"{field} can't be null or whitespace."));
  }

  private static void RequireOptionalNotWhiteSpace(string? value, string field, List<ValidationError> errors)
  {
    if (value is not null && string.IsNullOrWhiteSpace(value))
      errors.Add(new ValidationError(field, $"{field} can't be whitespace."));
  }

  private static void RequireMaxLength(string? value, string field, int maxLength, List<ValidationError> errors)
  {
    if (value is not null && value.Length > maxLength)
    {
      errors.Add(new ValidationError(field, $"{field} length must be less than or equal to {maxLength}."));
    }
  }

  private static void RequireDigitsPhone(string? value, string field, List<ValidationError> errors)
  {
    var validationError = UserInputPolicy.ValidatePhoneNumber(value, field);
    if (validationError is not null)
      errors.Add(new ValidationError(field, validationError));
  }

  /** Same as RequireDigitsPhone, but skips validation entirely when the
   *  caller didn't send the field. Used for partial-update endpoints. */
  private static void RequireOptionalDigitsPhone(string? value, string field, List<ValidationError> errors)
  {
    if (value is null) return;
    var validationError = UserInputPolicy.ValidatePhoneNumber(value, field);
    if (validationError is not null)
      errors.Add(new ValidationError(field, validationError));
  }

  private static void RequirePasswordByPolicy(string? value, string field, List<ValidationError> errors)
  {
    var validationError = UserInputPolicy.ValidatePassword(value, field);
    if (validationError is not null)
      errors.Add(new ValidationError(field, validationError));
  }

  private static void RequireGreaterThanZero(int value, string field, List<ValidationError> errors)
  {
    if (value <= 0)
      errors.Add(new ValidationError(field, $"{field} must be greater than zero."));
  }

  private static void RequireGreaterThanZero(decimal value, string field, List<ValidationError> errors)
  {
    if (value <= 0)
      errors.Add(new ValidationError(field, $"{field} must be greater than zero."));
  }

  private static void RequireNoEmptyGuids(
    IReadOnlyCollection<Guid>? values,
    string field,
    List<ValidationError> errors)
  {
    if (values is null)
      return;

    var index = 0;
    foreach (var value in values)
    {
      if (value == Guid.Empty)
        errors.Add(new ValidationError($"{field}[{index}]", "Guid can't be empty."));

      index++;
    }
  }
}

public sealed record ValidationError(string Field, string Message);
