using Yalla.Application.DTO.Request;
using Yalla.Application.Validation;

namespace Yalla.Application.UnitTests.Api;

public sealed class RequestDtoValidatorTests
{
  [Fact]
  public void Validate_RegisterClientRequest_WithInvalidFields_ShouldReturnErrors()
  {
    var request = new RegisterClientRequest
    {
      Name = " ",
      PhoneNumber = "abc123",
      Password = " "
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(RegisterClientRequest.Name));
    Assert.Contains(errors, x => x.Field == nameof(RegisterClientRequest.PhoneNumber));
    Assert.Contains(errors, x => x.Field == nameof(RegisterClientRequest.Password));
  }

  [Fact]
  public void Validate_UpdateBasketPositionQuantityRequest_WithInvalidFields_ShouldReturnErrors()
  {
    var request = new UpdateBasketPositionQuantityRequest
    {
      ClientId = Guid.Empty,
      PositionId = Guid.Empty,
      Quantity = 0
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(UpdateBasketPositionQuantityRequest.PositionId));
    Assert.Contains(errors, x => x.Field == nameof(UpdateBasketPositionQuantityRequest.Quantity));
    Assert.DoesNotContain(errors, x => x.Field == nameof(UpdateBasketPositionQuantityRequest.ClientId));
  }

  [Fact]
  public void Validate_CheckoutBasketRequest_WithInvalidFields_ShouldReturnErrors()
  {
    var request = new CheckoutBasketRequest
    {
      ClientId = Guid.Empty,
      PharmacyId = Guid.Empty,
      DeliveryAddress = " ",
      IgnoredPositionIds = [Guid.Empty]
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(CheckoutBasketRequest.PharmacyId));
    Assert.Contains(errors, x => x.Field == nameof(CheckoutBasketRequest.DeliveryAddress));
    Assert.Contains(errors, x => x.Field == $"{nameof(CheckoutBasketRequest.IgnoredPositionIds)}[0]");
    Assert.DoesNotContain(errors, x => x.Field == nameof(CheckoutBasketRequest.ClientId));
  }

  [Fact]
  public void Validate_CheckoutBasketRequest_PickupWithoutDeliveryAddress_ShouldNotReturnDeliveryAddressError()
  {
    var request = new CheckoutBasketRequest
    {
      PharmacyId = Guid.NewGuid(),
      IsPickup = true,
      DeliveryAddress = " "
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.DoesNotContain(errors, x => x.Field == nameof(CheckoutBasketRequest.DeliveryAddress));
  }

  [Fact]
  public void Validate_GetMedicinesCatalogRequest_WithInvalidPaging_ShouldReturnErrors()
  {
    var request = new GetMedicinesCatalogRequest
    {
      Page = 0,
      PageSize = 0
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(GetMedicinesCatalogRequest.Page));
    Assert.Contains(errors, x => x.Field == nameof(GetMedicinesCatalogRequest.PageSize));
  }

  [Fact]
  public void Validate_GetAdminsRequest_WithInvalidPaging_ShouldReturnErrors()
  {
    var request = new GetAdminsRequest
    {
      Page = 0,
      PageSize = 0
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(GetAdminsRequest.Page));
    Assert.Contains(errors, x => x.Field == nameof(GetAdminsRequest.PageSize));
  }

  [Fact]
  public void Validate_GetAllOrdersRequest_WithInvalidPaging_ShouldReturnErrors()
  {
    var request = new GetAllOrdersRequest
    {
      Page = 0,
      PageSize = 0
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(GetAllOrdersRequest.Page));
    Assert.Contains(errors, x => x.Field == nameof(GetAllOrdersRequest.PageSize));
  }

  [Fact]
  public void Validate_StartOrderAssemblyRequest_ShouldValidateOnlyClientProvidedOrderId()
  {
    var request = new StartOrderAssemblyRequest
    {
      WorkerId = Guid.Empty,
      OrderId = Guid.Empty
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(StartOrderAssemblyRequest.OrderId));
    Assert.DoesNotContain(errors, x => x.Field == nameof(StartOrderAssemblyRequest.WorkerId));
  }

  [Fact]
  public void Validate_DeleteNewOrderByAdminRequest_ShouldValidateOnlyOrderId()
  {
    var request = new DeleteNewOrderByAdminRequest
    {
      WorkerId = Guid.Empty,
      PharmacyId = Guid.Empty,
      OrderId = Guid.Empty
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(DeleteNewOrderByAdminRequest.OrderId));
    Assert.DoesNotContain(errors, x => x.Field == nameof(DeleteNewOrderByAdminRequest.WorkerId));
    Assert.DoesNotContain(errors, x => x.Field == nameof(DeleteNewOrderByAdminRequest.PharmacyId));
  }

  [Fact]
  public void Validate_ValidRegisterPharmacyWorkerRequest_ShouldReturnNoErrors()
  {
    var request = new RegisterPharmacyWorkerRequest
    {
      Name = "Admin",
      PhoneNumber = "992900001122",
      Password = "StrongPassword123",
      PharmacyId = Guid.NewGuid()
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Empty(errors);
  }

  [Fact]
  public void Validate_GetRefundRequestsRequest_WithInvalidPaging_ShouldReturnErrors()
  {
    var request = new GetRefundRequestsRequest
    {
      Page = 0,
      PageSize = 0
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(GetRefundRequestsRequest.Page));
    Assert.Contains(errors, x => x.Field == nameof(GetRefundRequestsRequest.PageSize));
  }

  [Fact]
  public void Validate_InitiateRefundBySuperAdminRequest_WithEmptyRefundRequestId_ShouldReturnError()
  {
    var request = new InitiateRefundBySuperAdminRequest
    {
      SuperAdminId = Guid.Empty,
      RefundRequestId = Guid.Empty
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(InitiateRefundBySuperAdminRequest.RefundRequestId));
    Assert.DoesNotContain(errors, x => x.Field == nameof(InitiateRefundBySuperAdminRequest.SuperAdminId));
  }

  [Fact]
  public void Validate_UpdateMyClientProfileRequest_WithInvalidFields_ShouldReturnErrors()
  {
    var request = new UpdateMyClientProfileRequest
    {
      Name = " ",
      PhoneNumber = "bad-phone"
    };

    var errors = RequestDtoValidator.Validate(request);

    Assert.Contains(errors, x => x.Field == nameof(UpdateMyClientProfileRequest.Name));
    Assert.Contains(errors, x => x.Field == nameof(UpdateMyClientProfileRequest.PhoneNumber));
  }
}
