using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Abstractions;

namespace Yalla.Application.Services;

public interface IMedicineService
{
  Task<CreateMedicineResponse> CreateMedicineAsync(
    CreateMedicineRequest request,
    CancellationToken cancellationToken = default);

  Task<UpdateMedicineResponse> UpdateMedicineAsync(
    UpdateMedicineRequest request,
    CancellationToken cancellationToken = default);

  Task<DeleteMedicineResponse> DeleteMedicineAsync(
    DeleteMedicineRequest request,
    CancellationToken cancellationToken = default);

  Task<GetMedicinesCatalogResponse> GetMedicinesCatalogAsync(
    GetMedicinesCatalogRequest request,
    CancellationToken cancellationToken = default);

  Task<GetAllMedicinesResponse> GetAllMedicinesAsync(
    GetAllMedicinesRequest request,
    CancellationToken cancellationToken = default);

  Task<GetMedicineByIdResponse> GetMedicineByIdAsync(
    GetMedicineByIdRequest request,
    CancellationToken cancellationToken = default);

  Task<SearchMedicinesResponse> SearchMedicinesAsync(
    SearchMedicinesRequest request,
    CancellationToken cancellationToken = default);

  Task<CreateMedicineImageResponse> CreateMedicineImageAsync(
    CreateMedicineImageRequest request,
    Stream imageContent,
    string fileName,
    string contentType,
    CancellationToken cancellationToken = default);

  Task<string> GetMedicineImageUrlAsync(
    Guid medicineImageId,
    CancellationToken cancellationToken = default);

  Task<MedicineImageContent> GetMedicineImageContentAsync(
    Guid medicineImageId,
    CancellationToken cancellationToken = default);

  Task<DeleteMedicineImageResponse> DeleteMedicineImageAsync(
    DeleteMedicineImageRequest request,
    CancellationToken cancellationToken = default);

  Task<SearchByPharmacyResponse> SearchByPharmacyAsync(
    SearchByPharmacyRequest request,
    CancellationToken cancellationToken = default);
}
