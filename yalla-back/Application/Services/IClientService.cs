using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IClientService
{
    Task<RegisterClientResponse> RegisterClientAsync(
      RegisterClientRequest request,
      CancellationToken cancellationToken = default);

    Task<RequestClientRegistrationVerificationResponse> RequestClientRegistrationVerificationAsync(
      RegisterClientRequest request,
      CancellationToken cancellationToken = default);

    Task<RegisterClientResponse> VerifyClientRegistrationAsync(
      VerifyClientRegistrationRequest request,
      CancellationToken cancellationToken = default);

    Task<RequestClientRegistrationVerificationResponse> ResendClientRegistrationVerificationAsync(
      ResendClientRegistrationRequest request,
      CancellationToken cancellationToken = default);

    Task<UpdateClientResponse> UpdateClientAsync(
      UpdateClientRequest request,
      CancellationToken cancellationToken = default);

    Task<DeleteClientResponse> DeleteClientAsync(
      DeleteClientRequest request,
      CancellationToken cancellationToken = default);

    Task<AddProductToBasketResponse> AddProductToBasketAsync(
      AddProductToBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<RemoveProductFromBasketResponse> RemoveProductFromBasketAsync(
      RemoveProductFromBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<UpdateBasketPositionQuantityResponse> UpdateBasketPositionQuantityAsync(
      UpdateBasketPositionQuantityRequest request,
      CancellationToken cancellationToken = default);

    Task<ClearBasketResponse> ClearBasketAsync(
      ClearBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<GetBasketResponse> GetBasketAsync(
      GetBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<GetAllClientsResponse> GetAllClientsAsync(
      GetAllClientsRequest request,
      CancellationToken cancellationToken = default);

    Task<GetAllClientsResponse> GetAllClientsWithBasketAsync(
      GetAllClientsRequest request,
      CancellationToken cancellationToken = default);

    Task<GetClientByPhoneNumberResponse> GetClientByPhoneNumberAsync(
      GetClientByPhoneNumberRequest request,
      CancellationToken cancellationToken = default);

    Task<GetClientByIdResponse> GetClientByIdAsync(
      GetClientByIdRequest request,
      CancellationToken cancellationToken = default);

    Task<CheckoutBasketResponse> CheckoutBasketAsync(
      CheckoutBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<CheckoutPreviewResponse> PreviewCheckoutAsync(
      CheckoutBasketRequest request,
      CancellationToken cancellationToken = default);

    Task<GuestBasketPreviewResponse> PreviewGuestBasketAsync(
      GuestBasketPreviewRequest request,
      CancellationToken cancellationToken = default);
}
