using Microsoft.EntityFrameworkCore;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;

namespace Yalla.Application.UnitTests.Services;

public class MedicineServiceTests
{
  private static readonly byte[] PngHeaderBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];

  [Fact]
  public async Task CreateMedicineAsync_CreatesMedicine()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    var response = await service.CreateMedicineAsync(new CreateMedicineRequest
    {
      Title = "Paracetamol",
      Articul = "P-1",
      Atributes = [new MedicineAtributeRequest { Type = AttributeType.ReleaseForm, Value = "tablet" }]
    });

    Assert.Equal("Paracetamol", response.Medicine.Title);
    Assert.Equal("P-1", response.Medicine.Articul);
    Assert.Single(scope.Db.Medicines);
  }

  [Fact]
  public async Task CreateMedicineAsync_ThrowsForDuplicateArticul()
  {
    using var scope = TestDbFactory.Create();
    var existing = TestDbFactory.CreateMedicine("M1", "DUP-1");
    scope.Db.Medicines.Add(existing);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineAsync(new CreateMedicineRequest
    {
      Title = "M2",
      Articul = "DUP-1"
    }));
  }

  [Fact]
  public async Task UpdateMedicineAsync_ThrowsWhenNotFound()
  {
    using var scope = TestDbFactory.Create();
    var service = new MedicineService(scope.Db);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateMedicineAsync(new UpdateMedicineRequest
    {
      MedicineId = Guid.NewGuid(),
      Title = "X",
      Articul = "Y"
    }));
  }

  [Fact]
  public async Task DeleteMedicineAsync_SoftDeletesMedicine()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("M", "M-1");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.DeleteMedicineAsync(new DeleteMedicineRequest { MedicineId = medicine.Id });

    Assert.False(response.IsActive);
  }

  [Fact]
  public async Task DeleteMedicineAsync_PermanentlyDeletesMedicineWithImagesOffersAndBasketPositions()
  {
    using var scope = TestDbFactory.Create();

    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy", "Addr", Guid.NewGuid());
    var client = TestDbFactory.CreateClient("Client", "900000001");
    var medicine = TestDbFactory.CreateMedicine("M", "M-2");
    var image = new MedicineImage(medicine.Id, "seed/permanent.png", isMain: true, isMinimal: true);
    medicine.AddImage(image);
    var offer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 5, price: 10m);
    var basketPosition = new BasketPosition(client.Id, medicine.Id, medicine, quantity: 2);

    scope.Db.AddRange(pharmacy, client, medicine, offer, basketPosition);
    await scope.Db.SaveChangesAsync();

    var storage = new TestMedicineImageStorage();
    storage.UploadedKeys.Add(image.Key);
    var service = new MedicineService(scope.Db, storage);

    var response = await service.DeleteMedicineAsync(new DeleteMedicineRequest
    {
      MedicineId = medicine.Id,
      Permanently = true
    });

    Assert.False(response.IsActive);
    Assert.False(await scope.Db.Medicines.AnyAsync(x => x.Id == medicine.Id));
    Assert.False(await scope.Db.MedicineImages.AnyAsync(x => x.MedicineId == medicine.Id));
    Assert.False(await scope.Db.Offers.AnyAsync(x => x.MedicineId == medicine.Id));
    Assert.False(await scope.Db.BasketPositions.AnyAsync(x => x.MedicineId == medicine.Id));
    Assert.DoesNotContain(image.Key, storage.UploadedKeys);
  }

  [Fact]
  public async Task DeleteMedicineAsync_PermanentDeleteThrowsWhenMedicineUsedInOrderHistory()
  {
    using var scope = TestDbFactory.Create();

    var pharmacy = TestDbFactory.CreatePharmacy("Pharmacy", "Addr", Guid.NewGuid());
    var client = TestDbFactory.CreateClient("Client", "900000002");
    var medicine = TestDbFactory.CreateMedicine("M", "M-3");
    var order = TestDbFactory.CreateOrder(
      client.Id,
      pharmacy.Id,
      "Address",
      (medicine, 11m, 1, false));

    scope.Db.AddRange(pharmacy, client, medicine, order);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteMedicineAsync(new DeleteMedicineRequest
    {
      MedicineId = medicine.Id,
      Permanently = true
    }));
  }

  [Fact]
  public async Task SearchMedicinesAsync_ReturnsOnlyActiveAndRespectsLimitAndRanking()
  {
    using var scope = TestDbFactory.Create();
    var m1 = TestDbFactory.CreateMedicine("Aspirin Forte", "A-11");
    var m2 = TestDbFactory.CreateMedicine("Cardio Aspirin", "C-22");
    var m3 = TestDbFactory.CreateMedicine("Random", "ASP-33");
    var m4 = TestDbFactory.CreateMedicine("Inactive Aspirin", "I-44", isActive: false);
    scope.Db.Medicines.AddRange(m1, m2, m3, m4);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.SearchMedicinesAsync(new SearchMedicinesRequest
    {
      Query = "asp",
      Limit = 2
    });

    Assert.Equal(2, response.Medicines.Count);
    Assert.Equal(m1.Id, response.Medicines.First().Id);
    Assert.DoesNotContain(response.Medicines, x => x.Id == m4.Id);
  }

  [Fact]
  public async Task GetMedicinesCatalogAsync_ReturnsOnlyActiveWithPaging()
  {
    using var scope = TestDbFactory.Create();
    var active1 = TestDbFactory.CreateMedicine("A", "A-1");
    var active2 = TestDbFactory.CreateMedicine("B", "B-1");
    var inactive = TestDbFactory.CreateMedicine("C", "C-1", isActive: false);
    scope.Db.Medicines.AddRange(active1, active2, inactive);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.GetMedicinesCatalogAsync(new GetMedicinesCatalogRequest
    {
      Page = 1,
      PageSize = 1
    });

    Assert.Equal(2, response.TotalCount);
    Assert.Single(response.Medicines);
    Assert.DoesNotContain(response.Medicines, x => x.Id == inactive.Id);
  }

  [Fact]
  public async Task GetMedicineByIdAsync_ReturnsMedicineWithAttributes()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-100");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.GetMedicineByIdAsync(new GetMedicineByIdRequest
    {
      MedicineId = medicine.Id
    });

    Assert.Equal(medicine.Id, response.Medicine.Id);
    Assert.Equal("Paracetamol", response.Medicine.Title);
    Assert.NotEmpty(response.Medicine.Atributes);
  }

  [Fact]
  public async Task GetMedicineByIdAsync_ReturnsOffersForClientAndSuperAdminViews()
  {
    using var scope = TestDbFactory.Create();

    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-1010");
    var activePharmacy = TestDbFactory.CreatePharmacy("B Active", "Addr 1", Guid.NewGuid(), isActive: true);
    var inactivePharmacy = TestDbFactory.CreatePharmacy("A Inactive", "Addr 2", Guid.NewGuid(), isActive: false);
    var activeOffer = TestDbFactory.CreateOffer(medicine.Id, activePharmacy.Id, stock: 7, price: 5.5m);
    var inactiveOffer = TestDbFactory.CreateOffer(medicine.Id, inactivePharmacy.Id, stock: 7, price: 4.5m);

    scope.Db.AddRange(medicine, activePharmacy, inactivePharmacy, activeOffer, inactiveOffer);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db);
    var response = await service.GetMedicineByIdAsync(new GetMedicineByIdRequest
    {
      MedicineId = medicine.Id
    });

    Assert.Equal(2, response.Medicine.Offers.Count);
    var firstOffer = response.Medicine.Offers.First();
    var secondOffer = response.Medicine.Offers.Skip(1).First();
    Assert.Equal("A Inactive", firstOffer.PharmacyTitle);
    Assert.False(firstOffer.IsAvailable);
    Assert.Equal("B Active", secondOffer.PharmacyTitle);
    Assert.True(secondOffer.IsAvailable);
  }

  [Fact]
  public async Task CreateMedicineImageAsync_AddsImageToMedicine()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-100");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var storage = new TestMedicineImageStorage();
    var service = new MedicineService(scope.Db, storage);

    await using var imageStream = new MemoryStream(PngHeaderBytes);
    var response = await service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "image/png");

    Assert.NotEqual(Guid.Empty, response.MedicineImage.Id);
    Assert.True(response.MedicineImage.IsMain);
    Assert.True(response.MedicineImage.IsMinimal);
    Assert.Single(scope.Db.MedicineImages);
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsForUnsupportedImageContent()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-101");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var storage = new TestMedicineImageStorage();
    var service = new MedicineService(scope.Db, storage);

    await using var imageStream = new MemoryStream([1, 2, 3, 4, 5, 6, 7, 8]);
    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "image/png"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsForUnsupportedExtension()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-102");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream(PngHeaderBytes);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.txt",
      "image/png"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsForMismatchedContentType()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-103");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream(PngHeaderBytes);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "image/jpeg"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_AllowsGenericOctetStreamWhenContentIsValid()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-104");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream(PngHeaderBytes);

    var response = await service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "application/octet-stream");

    Assert.False(string.IsNullOrWhiteSpace(response.MedicineImage.Key));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsWhenMainImageAlreadyExists()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-105");
    medicine.AddImage(new MedicineImage(medicine.Id, "seed/main.png", isMain: true, isMinimal: false));
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream(PngHeaderBytes);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = false
      },
      imageStream,
      "medicine.png",
      "image/png"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsWhenMinimalImageAlreadyExists()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-106");
    medicine.AddImage(new MedicineImage(medicine.Id, "seed/minimal.png", isMain: false, isMinimal: true));
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new MemoryStream(PngHeaderBytes);

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = false,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "image/png"));
  }

  [Fact]
  public async Task CreateMedicineImageAsync_ThrowsWhenFileExceedsLimit()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-107");
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var service = new MedicineService(scope.Db, new TestMedicineImageStorage());
    await using var imageStream = new OversizedPngStream();

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateMedicineImageAsync(
      new CreateMedicineImageRequest
      {
        MedicineId = medicine.Id,
        IsMain = true,
        IsMinimal = true
      },
      imageStream,
      "medicine.png",
      "image/png"));
  }

  [Fact]
  public async Task DeleteMedicineImageAsync_RemovesImageFromMedicine()
  {
    using var scope = TestDbFactory.Create();
    var medicine = TestDbFactory.CreateMedicine("Paracetamol", "P-100");
    var image = new MedicineImage(medicine.Id, "seed/key.png", isMain: true, isMinimal: true);
    medicine.AddImage(image);
    scope.Db.Medicines.Add(medicine);
    await scope.Db.SaveChangesAsync();

    var storage = new TestMedicineImageStorage();
    storage.UploadedKeys.Add(image.Key);
    var service = new MedicineService(scope.Db, storage);

    var response = await service.DeleteMedicineImageAsync(new DeleteMedicineImageRequest
    {
      MedicineId = medicine.Id,
      MedicineImageId = image.Id
    });

    Assert.Equal(medicine.Id, response.MedicineId);
    Assert.Equal(image.Id, response.MedicineImageId);
    Assert.Empty(scope.Db.MedicineImages);
  }

  private sealed class OversizedPngStream : MemoryStream
  {
    public override long Length => (50L * 1024 * 1024) + 1;
  }
}
