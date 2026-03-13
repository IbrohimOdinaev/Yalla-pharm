using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;

namespace Yalla.Application.UnitTests.Services;

public class MedicineServiceRequestDrivenTests
{
  [Fact]
  public async Task CreateMedicineAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.CreateMedicineAsync(null!));
  }

  [Fact]
  public async Task UpdateMedicineAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.UpdateMedicineAsync(null!));
  }

  [Fact]
  public async Task DeleteMedicineAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.DeleteMedicineAsync(null!));
  }

  [Fact]
  public async Task SearchMedicinesAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.SearchMedicinesAsync(null!));
  }

  [Fact]
  public async Task GetMedicinesCatalogAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.GetMedicinesCatalogAsync(null!));
  }

  [Fact]
  public async Task GetMedicineByIdAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.GetMedicineByIdAsync(null!));
  }

  [Fact]
  public async Task CreateMedicineAsync_UsesTrimmedArticul_ForUniqueness()
  {
    using var scope = TestDbFactory.Create();
    scope.Db.Medicines.Add(TestDbFactory.CreateMedicine("First", "TRIM-1"));
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineAsync(new CreateMedicineRequest
    {
      Title = "Second",
      Articul = "  TRIM-1  "
    }));
  }

  [Fact]
  public async Task UpdateMedicineAsync_ThrowsForDuplicateArticul()
  {
    using var scope = TestDbFactory.Create();
    var m1 = TestDbFactory.CreateMedicine("M1", "M-101");
    var m2 = TestDbFactory.CreateMedicine("M2", "M-102");
    scope.Db.Medicines.AddRange(m1, m2);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateMedicineAsync(new UpdateMedicineRequest
    {
      MedicineId = m2.Id,
      Title = "M2 updated",
      Articul = "  M-101 "
    }));
  }

  [Fact]
  public async Task UpdateMedicineAsync_UpdatesCoreFields()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Old", "OLD-1");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.UpdateMedicineAsync(new UpdateMedicineRequest
    {
      MedicineId = medicine.Id,
      Title = " New title ",
      Articul = " NEW-1 "
    });

    Assert.Equal("New title", response.Medicine.Title);
    Assert.Equal("NEW-1", response.Medicine.Articul);
  }

  [Fact]
  public async Task DeleteMedicineAsync_ThrowsWhenMedicineMissing()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteMedicineAsync(new DeleteMedicineRequest
    {
      MedicineId = Guid.NewGuid()
    }));
  }

  [Fact]
  public async Task SearchMedicinesAsync_EmptyQuery_ReturnsEmptyList()
  {
    using var scope = TestDbFactory.Create();
    scope.Db.Medicines.Add(TestDbFactory.CreateMedicine("Any", "ANY-1"));
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.SearchMedicinesAsync(new SearchMedicinesRequest
    {
      Query = "   ",
      Limit = 5
    });

    Assert.Empty(response.Medicines);
    Assert.Equal(string.Empty, response.Query);
    Assert.Equal(5, response.Limit);
  }

  [Fact]
  public async Task SearchMedicinesAsync_NormalizesLimit_Bounds()
  {
    using var scope = TestDbFactory.Create();
    scope.Db.Medicines.Add(TestDbFactory.CreateMedicine("Aspirin", "ASP-1"));
    await scope.Db.SaveChangesAsync();
    var service = new MedicineService(scope.Db);

    var lowLimit = await service.SearchMedicinesAsync(new SearchMedicinesRequest
    {
      Query = "asp",
      Limit = 0
    });
    var highLimit = await service.SearchMedicinesAsync(new SearchMedicinesRequest
    {
      Query = "asp",
      Limit = 500
    });

    Assert.Equal(20, lowLimit.Limit);
    Assert.Equal(50, highLimit.Limit);
  }

  [Fact]
  public async Task SearchMedicinesAsync_IsCaseInsensitive()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Aspirin Max", "aSp-2");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.SearchMedicinesAsync(new SearchMedicinesRequest
    {
      Query = "ASP",
      Limit = 20
    });

    Assert.Contains(response.Medicines, x => x.Id == medicine.Id);
  }

  [Fact]
  public async Task GetMedicineByIdAsync_ThrowsForEmptyId()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetMedicineByIdAsync(new GetMedicineByIdRequest
    {
      MedicineId = Guid.Empty
    }));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream([1, 2, 3]);

    await Assert.ThrowsAsync<ArgumentNullException>(() =>
      service.CreateMedicineImageAsync(null!, imageStream, "file.png", "image/png"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsForNullImageStream()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("M", "MID-1");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());

    await Assert.ThrowsAsync<ArgumentNullException>(() =>
      service.CreateMedicineImageAsync(
        new CreateMedicineImageRequest
        {
          MedicineId = medicine.Id,
          IsMain = true,
          IsMinimal = true
        },
        null!,
        "file.png",
        "image/png"));
  }

  [Fact]
  public async Task DeleteMedicineImageAsync_ThrowsForNullRequest()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());

    await Assert.ThrowsAsync<ArgumentNullException>(() => service.DeleteMedicineImageAsync(null!));
  }
}
