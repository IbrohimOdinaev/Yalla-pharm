using Yalla.Application.DTO.Request;
using Yalla.Application.Validation;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Api;

public sealed class RequestDtoValidatorAllCasesTests
{
  [Fact]
  public void AddProductToBasket_Invalid_ShouldReturnErrors()
  {
    var request = new AddProductToBasketRequest
    {
      MedicineId = Guid.Empty,
      Quantity = 0
    };

    AssertHasErrors(request, nameof(AddProductToBasketRequest.MedicineId), nameof(AddProductToBasketRequest.Quantity));
  }

  [Fact]
  public void AddProductToBasket_Valid_ShouldReturnNoErrors()
  {
    var request = new AddProductToBasketRequest
    {
      MedicineId = Guid.NewGuid(),
      Quantity = 2
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void CancelOrder_Invalid_ShouldReturnError()
  {
    var request = new CancelOrderRequest { OrderId = Guid.Empty };
    AssertHasErrors(request, nameof(CancelOrderRequest.OrderId));
  }

  [Fact]
  public void ChangePassword_Invalid_ShouldReturnErrors()
  {
    var request = new ChangePasswordRequest
    {
      CurrentPassword = " ",
      NewPassword = " "
    };

    AssertHasErrors(request, nameof(ChangePasswordRequest.CurrentPassword), nameof(ChangePasswordRequest.NewPassword));
  }

  [Fact]
  public void CheckoutBasket_Invalid_ShouldReturnErrors()
  {
    var request = new CheckoutBasketRequest
    {
      PharmacyId = Guid.Empty,
      DeliveryAddress = " ",
      IgnoredPositionIds = [Guid.Empty]
    };

    AssertHasErrors(
      request,
      nameof(CheckoutBasketRequest.PharmacyId),
      nameof(CheckoutBasketRequest.DeliveryAddress),
      $"{nameof(CheckoutBasketRequest.IgnoredPositionIds)}[0]");
  }

  [Fact]
  public void CheckoutBasket_Valid_ShouldReturnNoErrors()
  {
    var request = new CheckoutBasketRequest
    {
      PharmacyId = Guid.NewGuid(),
      DeliveryAddress = "A",
      IgnoredPositionIds = [Guid.NewGuid()]
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void CheckoutBasket_PickupWithoutDeliveryAddress_ShouldReturnNoErrors()
  {
    var request = new CheckoutBasketRequest
    {
      PharmacyId = Guid.NewGuid(),
      IsPickup = true,
      DeliveryAddress = " "
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void ClearBasket_ShouldReturnNoErrors()
  {
    AssertNoErrors(new ClearBasketRequest());
  }

  [Fact]
  public void CreateMedicine_InvalidBaseFields_ShouldReturnErrors()
  {
    var request = new CreateMedicineRequest
    {
      Title = " ",
      Articul = " ",
      Atributes = []
    };

    AssertHasErrors(
      request,
      nameof(CreateMedicineRequest.Title),
      nameof(CreateMedicineRequest.Articul));
  }

  [Fact]
  public void CreateMedicine_NullAttributes_ShouldReturnError()
  {
    var request = new CreateMedicineRequest
    {
      Title = "M",
      Articul = "A",
      Atributes = null!
    };

    AssertHasErrors(request, nameof(CreateMedicineRequest.Atributes));
  }

  [Fact]
  public void CreateMedicine_InvalidAttributeItems_ShouldReturnErrors()
  {
    var request = new CreateMedicineRequest
    {
      Title = "M",
      Articul = "A",
      Atributes =
      [
        null!,
        new MedicineAtributeRequest { Name = " ", Option = " " }
      ]
    };

    AssertHasErrors(
      request,
      $"{nameof(CreateMedicineRequest.Atributes)}[0]",
      $"{nameof(CreateMedicineRequest.Atributes)}[1].{nameof(MedicineAtributeRequest.Name)}",
      $"{nameof(CreateMedicineRequest.Atributes)}[1].{nameof(MedicineAtributeRequest.Option)}");
  }

  [Fact]
  public void CreateMedicine_Valid_ShouldReturnNoErrors()
  {
    var request = new CreateMedicineRequest
    {
      Title = "M",
      Articul = "A-1",
      Atributes = [new MedicineAtributeRequest { Name = "dosage", Option = "500mg" }]
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void DeleteRequests_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(new DeleteClientRequest { ClientId = Guid.Empty }, nameof(DeleteClientRequest.ClientId));
    AssertHasErrors(new DeleteMedicineRequest { MedicineId = Guid.Empty }, nameof(DeleteMedicineRequest.MedicineId));
    AssertHasErrors(new DeleteNewOrderByAdminRequest { OrderId = Guid.Empty }, nameof(DeleteNewOrderByAdminRequest.OrderId));
    AssertHasErrors(
      new DeleteMedicineImageRequest { MedicineId = Guid.Empty, MedicineImageId = Guid.Empty },
      nameof(DeleteMedicineImageRequest.MedicineId),
      nameof(DeleteMedicineImageRequest.MedicineImageId));
    AssertHasErrors(new DeletePharmacyRequest { PharmacyId = Guid.Empty }, nameof(DeletePharmacyRequest.PharmacyId));
    AssertHasErrors(new DeletePharmacyWorkerRequest { PharmacyWorkerId = Guid.Empty }, nameof(DeletePharmacyWorkerRequest.PharmacyWorkerId));
  }

  [Fact]
  public void CreateMedicineImage_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(
      new CreateMedicineImageRequest
      {
        MedicineId = Guid.Empty,
        IsMain = null,
        IsMinimal = null
      },
      nameof(CreateMedicineImageRequest.MedicineId),
      nameof(CreateMedicineImageRequest.IsMain),
      nameof(CreateMedicineImageRequest.IsMinimal));
  }

  [Fact]
  public void PagingRequests_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(new GetAllClientsRequest { Page = 0, PageSize = 0 }, nameof(GetAllClientsRequest.Page), nameof(GetAllClientsRequest.PageSize));
    AssertHasErrors(new GetAdminsRequest { Page = 0, PageSize = 0 }, nameof(GetAdminsRequest.Page), nameof(GetAdminsRequest.PageSize));
    AssertHasErrors(new GetAllOrdersRequest { Page = 0, PageSize = 0 }, nameof(GetAllOrdersRequest.Page), nameof(GetAllOrdersRequest.PageSize));
    AssertHasErrors(new GetMedicinesCatalogRequest { Page = 0, PageSize = 0 }, nameof(GetMedicinesCatalogRequest.Page), nameof(GetMedicinesCatalogRequest.PageSize));
    AssertHasErrors(new GetRefundRequestsRequest { Page = 0, PageSize = 0 }, nameof(GetRefundRequestsRequest.Page), nameof(GetRefundRequestsRequest.PageSize));
  }

  [Fact]
  public void PagingRequests_Valid_ShouldReturnNoErrors()
  {
    AssertNoErrors(new GetAllClientsRequest { Page = 1, PageSize = 1 });
    AssertNoErrors(new GetAdminsRequest { Page = 1, PageSize = 1 });
    AssertNoErrors(new GetAllOrdersRequest { Status = Status.Ready, Page = 1, PageSize = 1 });
    AssertNoErrors(new GetMedicinesCatalogRequest { Page = 1, PageSize = 1 });
    AssertNoErrors(new GetRefundRequestsRequest { Page = 1, PageSize = 1 });
  }

  [Fact]
  public void PhoneRequests_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(new GetClientByPhoneNumberRequest { PhoneNumber = "abc" }, nameof(GetClientByPhoneNumberRequest.PhoneNumber));
    AssertHasErrors(new LoginRequest { PhoneNumber = " ", Password = " " }, nameof(LoginRequest.PhoneNumber), nameof(LoginRequest.Password));
    AssertHasErrors(new RegisterClientRequest { Name = "X", PhoneNumber = "bad", Password = "p" }, nameof(RegisterClientRequest.PhoneNumber));
    AssertHasErrors(new RegisterPharmacyWorkerRequest { Name = "X", PhoneNumber = "bad", Password = "p", PharmacyId = Guid.NewGuid() }, nameof(RegisterPharmacyWorkerRequest.PhoneNumber));
    AssertHasErrors(new UpdateAdminProfileRequest { Name = "X", PhoneNumber = "bad" }, nameof(UpdateAdminProfileRequest.PhoneNumber));
    AssertHasErrors(new UpdateClientRequest { ClientId = Guid.NewGuid(), Name = "X", PhoneNumber = "bad" }, nameof(UpdateClientRequest.PhoneNumber));
    AssertHasErrors(new UpdateMyClientProfileRequest { Name = "X", PhoneNumber = "bad" }, nameof(UpdateMyClientProfileRequest.PhoneNumber));
  }

  [Fact]
  public void PhoneRequests_Valid_ShouldReturnNoErrors()
  {
    AssertNoErrors(new GetClientByPhoneNumberRequest { PhoneNumber = " 992001122 " });
    AssertNoErrors(new LoginRequest { PhoneNumber = "992001122", Password = "p" });
    AssertNoErrors(new RegisterClientRequest { Name = "C", PhoneNumber = "992001122", Password = "Pass123!" });
    AssertNoErrors(new RegisterPharmacyWorkerRequest { Name = "A", PhoneNumber = "992001123", Password = "Pass123!", PharmacyId = Guid.NewGuid() });
    AssertNoErrors(new UpdateAdminProfileRequest { Name = "A", PhoneNumber = "992001124" });
    AssertNoErrors(new UpdateClientRequest { ClientId = Guid.NewGuid(), Name = "C", PhoneNumber = "992001125" });
    AssertNoErrors(new UpdateMyClientProfileRequest { Name = "C", PhoneNumber = "992001126" });
  }

  [Fact]
  public void GetClientOrderHistory_ShouldReturnNoErrors()
  {
    AssertNoErrors(new GetClientOrderHistoryRequest { ClientId = Guid.Empty });
  }

  [Fact]
  public void GetNewOrdersForWorker_Invalid_ShouldReturnError()
  {
    AssertHasErrors(new GetNewOrdersForWorkerRequest { Take = 0 }, nameof(GetNewOrdersForWorkerRequest.Take));
  }

  [Fact]
  public void GetNewOrdersForWorker_Valid_ShouldReturnNoErrors()
  {
    AssertNoErrors(new GetNewOrdersForWorkerRequest { Take = 1 });
  }

  [Fact]
  public void InitiateRefundBySuperAdmin_Invalid_ShouldReturnError()
  {
    AssertHasErrors(
      new InitiateRefundBySuperAdminRequest { SuperAdminId = Guid.Empty, RefundRequestId = Guid.Empty },
      nameof(InitiateRefundBySuperAdminRequest.RefundRequestId));
  }

  [Fact]
  public void MarkOrderTransitions_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(new MarkOrderDeliveredBySuperAdminRequest { OrderId = Guid.Empty }, nameof(MarkOrderDeliveredBySuperAdminRequest.OrderId));
    AssertHasErrors(new MarkOrderOnTheWayRequest { OrderId = Guid.Empty }, nameof(MarkOrderOnTheWayRequest.OrderId));
    AssertHasErrors(new MarkOrderReadyRequest { OrderId = Guid.Empty }, nameof(MarkOrderReadyRequest.OrderId));
    AssertHasErrors(new StartOrderAssemblyRequest { OrderId = Guid.Empty }, nameof(StartOrderAssemblyRequest.OrderId));
  }

  [Fact]
  public void MarkOrderTransitions_Valid_ShouldReturnNoErrors()
  {
    AssertNoErrors(new MarkOrderDeliveredBySuperAdminRequest { OrderId = Guid.NewGuid() });
    AssertNoErrors(new MarkOrderOnTheWayRequest { OrderId = Guid.NewGuid() });
    AssertNoErrors(new MarkOrderReadyRequest { OrderId = Guid.NewGuid() });
    AssertNoErrors(new StartOrderAssemblyRequest { OrderId = Guid.NewGuid() });
  }

  [Fact]
  public void PayForOrder_Invalid_ShouldReturnErrors()
  {
    var request = new PayForOrderRequest
    {
      OrderId = Guid.Empty,
      ClientId = Guid.Empty,
      PharmacyId = Guid.Empty,
      Amount = 0,
      Currency = " "
    };

    AssertHasErrors(
      request,
      nameof(PayForOrderRequest.OrderId),
      nameof(PayForOrderRequest.ClientId),
      nameof(PayForOrderRequest.PharmacyId),
      nameof(PayForOrderRequest.Amount),
      nameof(PayForOrderRequest.Currency));
  }

  [Fact]
  public void PayForOrder_Valid_ShouldReturnNoErrors()
  {
    var request = new PayForOrderRequest
    {
      OrderId = Guid.NewGuid(),
      ClientId = Guid.NewGuid(),
      PharmacyId = Guid.NewGuid(),
      Amount = 10m,
      Currency = "TJS"
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void RegisterPharmacy_Invalid_ShouldReturnErrors()
  {
    var request = new RegisterPharmacyRequest
    {
      Title = " ",
      Address = " ",
      AdminId = Guid.Empty
    };

    AssertHasErrors(
      request,
      nameof(RegisterPharmacyRequest.Title),
      nameof(RegisterPharmacyRequest.Address),
      nameof(RegisterPharmacyRequest.AdminId));
  }

  [Fact]
  public void RegisterPharmacy_Valid_ShouldReturnNoErrors()
  {
    var request = new RegisterPharmacyRequest
    {
      Title = "Ph",
      Address = "Addr",
      AdminId = Guid.NewGuid()
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void RegisterPharmacyWorker_Invalid_ShouldReturnErrors()
  {
    var request = new RegisterPharmacyWorkerRequest
    {
      Name = " ",
      PhoneNumber = "bad",
      Password = " ",
      PharmacyId = Guid.Empty
    };

    AssertHasErrors(
      request,
      nameof(RegisterPharmacyWorkerRequest.Name),
      nameof(RegisterPharmacyWorkerRequest.PhoneNumber),
      nameof(RegisterPharmacyWorkerRequest.Password),
      nameof(RegisterPharmacyWorkerRequest.PharmacyId));
  }

  [Fact]
  public void RejectOrderPositions_Invalid_ShouldReturnErrors()
  {
    var request = new RejectOrderPositionsRequest
    {
      OrderId = Guid.Empty,
      PositionIds = []
    };

    AssertHasErrors(
      request,
      nameof(RejectOrderPositionsRequest.OrderId),
      nameof(RejectOrderPositionsRequest.PositionIds));
  }

  [Fact]
  public void RejectOrderPositions_WithEmptyGuid_ShouldReturnError()
  {
    var request = new RejectOrderPositionsRequest
    {
      OrderId = Guid.NewGuid(),
      PositionIds = [Guid.Empty]
    };

    AssertHasErrors(request, $"{nameof(RejectOrderPositionsRequest.PositionIds)}[0]");
  }

  [Fact]
  public void RejectOrderPositions_Valid_ShouldReturnNoErrors()
  {
    var request = new RejectOrderPositionsRequest
    {
      OrderId = Guid.NewGuid(),
      PositionIds = [Guid.NewGuid()]
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void RemoveProductFromBasket_Invalid_ShouldReturnError()
  {
    AssertHasErrors(new RemoveProductFromBasketRequest { PositionId = Guid.Empty }, nameof(RemoveProductFromBasketRequest.PositionId));
  }

  [Fact]
  public void SearchMedicines_Invalid_ShouldReturnError()
  {
    AssertHasErrors(new SearchMedicinesRequest { Limit = 0 }, nameof(SearchMedicinesRequest.Limit));
  }

  [Fact]
  public void SearchMedicines_Valid_ShouldReturnNoErrors()
  {
    AssertNoErrors(new SearchMedicinesRequest { Limit = 1, Query = string.Empty });
  }

  [Fact]
  public void UpdateAdminProfile_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(
      new UpdateAdminProfileRequest { Name = " ", PhoneNumber = "bad" },
      nameof(UpdateAdminProfileRequest.Name),
      nameof(UpdateAdminProfileRequest.PhoneNumber));
  }

  [Fact]
  public void UpdateBasketPositionQuantity_Invalid_ShouldReturnErrors()
  {
    var request = new UpdateBasketPositionQuantityRequest
    {
      PositionId = Guid.Empty,
      Quantity = 0
    };

    AssertHasErrors(request, nameof(UpdateBasketPositionQuantityRequest.PositionId), nameof(UpdateBasketPositionQuantityRequest.Quantity));
  }

  [Fact]
  public void UpdateClient_Invalid_ShouldReturnErrors()
  {
    var request = new UpdateClientRequest
    {
      ClientId = Guid.Empty,
      Name = " ",
      PhoneNumber = "bad"
    };

    AssertHasErrors(
      request,
      nameof(UpdateClientRequest.ClientId),
      nameof(UpdateClientRequest.Name),
      nameof(UpdateClientRequest.PhoneNumber));
  }

  [Fact]
  public void UpdateMyClientProfile_Invalid_ShouldReturnErrors()
  {
    AssertHasErrors(
      new UpdateMyClientProfileRequest { Name = " ", PhoneNumber = "bad" },
      nameof(UpdateMyClientProfileRequest.Name),
      nameof(UpdateMyClientProfileRequest.PhoneNumber));
  }

  [Fact]
  public void UpdateMedicine_Invalid_ShouldReturnErrors()
  {
    var request = new UpdateMedicineRequest
    {
      MedicineId = Guid.Empty,
      Title = " ",
      Articul = " "
    };

    AssertHasErrors(
      request,
      nameof(UpdateMedicineRequest.MedicineId),
      nameof(UpdateMedicineRequest.Title),
      nameof(UpdateMedicineRequest.Articul));
  }

  [Fact]
  public void UpdateMedicine_Valid_ShouldReturnNoErrors()
  {
    var request = new UpdateMedicineRequest
    {
      MedicineId = Guid.NewGuid(),
      Title = "M",
      Articul = "A"
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void UpdatePharmacy_Invalid_ShouldReturnErrors()
  {
    var request = new UpdatePharmacyRequest
    {
      PharmacyId = Guid.Empty,
      Title = " ",
      Address = " ",
      AdminId = Guid.Empty
    };

    AssertHasErrors(
      request,
      nameof(UpdatePharmacyRequest.PharmacyId),
      nameof(UpdatePharmacyRequest.Title),
      nameof(UpdatePharmacyRequest.Address),
      nameof(UpdatePharmacyRequest.AdminId));
  }

  [Fact]
  public void UpdatePharmacy_Valid_ShouldReturnNoErrors()
  {
    var request = new UpdatePharmacyRequest
    {
      PharmacyId = Guid.NewGuid(),
      Title = "Ph",
      Address = "Addr",
      AdminId = Guid.NewGuid()
    };

    AssertNoErrors(request);
  }

  [Fact]
  public void NonMappedRequestDtos_ShouldReturnNoErrors()
  {
    AssertNoErrors(new GetBasketRequest { ClientId = Guid.Empty });
    AssertNoErrors(new GetClientByIdRequest { ClientId = Guid.Empty });
    AssertNoErrors(new GetClientOrderDetailsRequest { ClientId = Guid.Empty, OrderId = Guid.Empty });
    AssertNoErrors(new GetMedicineByIdRequest { MedicineId = Guid.Empty });
  }

  private static void AssertNoErrors(object request)
  {
    var errors = RequestDtoValidator.Validate(request);
    Assert.Empty(errors);
  }

  private static void AssertHasErrors(object request, params string[] fields)
  {
    var errors = RequestDtoValidator.Validate(request);
    Assert.NotEmpty(errors);

    foreach (var field in fields)
      Assert.Contains(errors, x => x.Field == field);
  }
}
