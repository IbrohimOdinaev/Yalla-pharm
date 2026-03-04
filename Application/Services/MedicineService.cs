using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Application.Extensions;

namespace Yalla.Application.Services;

public sealed class MedicineService : IMedicineService
{
    private readonly IAppDbContext _dbContext;

    public MedicineService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<CreateMedicineResponse> CreateMedicineAsync(
      CreateMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var articul = request.Articul.Trim();
        var articulExists = await _dbContext.Medicines
          .AnyAsync(x => x.Articul == articul, cancellationToken);

        if (articulExists)
            throw new InvalidOperationException($"Medicine with articul '{articul}' already exists.");

        var medicine = request.ToDomain();

        _dbContext.Medicines.Add(medicine);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateMedicineResponse
        {
            Medicine = medicine.ToResponse()
        };
    }

    public async Task<UpdateMedicineResponse> UpdateMedicineAsync(
      UpdateMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var articul = request.Articul.Trim();
        var articulExists = await _dbContext.Medicines
          .AnyAsync(x => x.Articul == articul && x.Id != request.MedicineId, cancellationToken);

        if (articulExists)
            throw new InvalidOperationException($"Medicine with articul '{articul}' already exists.");

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .Include(x => x.Atributes)
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        request.ApplyToDomain(medicine);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UpdateMedicineResponse
        {
            Medicine = medicine.ToResponse()
        };
    }

    public async Task<DeleteMedicineResponse> DeleteMedicineAsync(
      DeleteMedicineRequest request,
      CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var medicine = await _dbContext.Medicines
          .AsTracking()
          .FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
          ?? throw new InvalidOperationException($"Medicine with id '{request.MedicineId}' was not found.");

        medicine.SetIsActive(false);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeleteMedicineResponse
        {
            MedicineId = request.MedicineId,
            IsActive = medicine.IsActive
        };
    }
}
