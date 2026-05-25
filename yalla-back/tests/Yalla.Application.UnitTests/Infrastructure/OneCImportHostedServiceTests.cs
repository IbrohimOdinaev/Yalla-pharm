using System.Reflection;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;
using Yalla.Infrastructure.OneC;

namespace Yalla.Application.UnitTests.Infrastructure;

public sealed class OneCImportHostedServiceTests
{
  [Fact]
  public void ParseOffers_HandlesCommerceMlNamespaceCommaPriceAndWarehouseStocks()
  {
    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>product-1#characteristic-1</Ид>
              <Склады ИдСклада="warehouse-a" КоличествоНаСкладе="2"/>
              <Склады ИдСклада="warehouse-b" КоличествоНаСкладе="5"/>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>123,45</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var offers = InvokeParser("ParseOffers", file);

    var offer = Assert.Single(offers);
    Assert.Equal("product-1", Get<string>(offer, "ExternalProductId"));
    Assert.Equal(123.45m, Get<decimal>(offer, "Price"));
    Assert.Equal(7, Get<int>(offer, "Stock"));
  }

  [Fact]
  public void ParseOffers_GroupsCompositeOfferIdsByProductIdSumsStockAndUsesMaxPrice()
  {
    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>abc#part1</Ид>
              <Количество>3</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>51</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
            <Предложение>
              <Ид>abc#part2</Ид>
              <Количество>5</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>68</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
            <Предложение>
              <Ид>abc#part-without-price</Ид>
              <Количество>2</Количество>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var offers = InvokeParser("ParseOffers", file);

    var offer = Assert.Single(offers);
    Assert.Equal("abc", Get<string>(offer, "ExternalProductId"));
    Assert.Equal(68m, Get<decimal>(offer, "Price"));
    Assert.Equal(10, Get<int>(offer, "Stock"));
    Assert.Equal(
      ["abc#part1", "abc#part2", "abc#part-without-price"],
      Get<IReadOnlyList<string>>(offer, "SourceOfferIds"));
  }

  [Fact]
  public void ParseOffers_UsesQuantityBeforeWarehouseStock()
  {
    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>product-qty</Ид>
              <Количество>4</Количество>
              <Склады>
                <Склад ИдСклада="warehouse-a" КоличествоНаСкладе="10"/>
                <Склад ИдСклада="warehouse-b" КоличествоНаСкладе="15"/>
              </Склады>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>22</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var offers = InvokeParser("ParseOffers", file);

    var offer = Assert.Single(offers);
    Assert.Equal("product-qty", Get<string>(offer, "ExternalProductId"));
    Assert.Equal(22m, Get<decimal>(offer, "Price"));
    Assert.Equal(4, Get<int>(offer, "Stock"));
  }

  [Fact]
  public void ParseOffers_KeepsOfferWhenPriceIsMissing()
  {
    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>product-no-price#stock-only</Ид>
              <Количество>9</Количество>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var offers = InvokeParser("ParseOffers", file);

    var offer = Assert.Single(offers);
    Assert.Equal("product-no-price", Get<string>(offer, "ExternalProductId"));
    Assert.Null(GetRaw(offer, "Price"));
    Assert.Equal(9, Get<int>(offer, "Stock"));
  }

  [Fact]
  public async Task ProcessOffersFileAsync_UpdatesLinkedOfferFromGroupedCompositeIds()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000001", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Analgin", "AN-1");
    var source = new IntegrationSource(pharmacy.Id, "1c", "nishon_1C", "Nishon 1C", DateTime.UtcNow);
    var link = new ExternalProductLink(
      source.Id,
      pharmacy.Id,
      "1c",
      "abc",
      null,
      "External Analgin",
      DateTime.UtcNow);
    link.Confirm(medicine.Id);

    db.AddRange(admin, pharmacy, medicine, source, link);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>abc#part1</Ид>
              <Количество>3</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>51</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
            <Предложение>
              <Ид>abc#part2</Ид>
              <Количество>5</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>68</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var result = await InvokeProcessOffersAsync(db, source, file);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(68m, offer.Price);
    Assert.Equal(8, offer.StockQuantity);
    Assert.Equal(0, Get<int>(result, "Updated"));
    Assert.Equal(1, Get<int>(result, "Inserted"));
  }

  [Fact]
  public async Task ProcessOffersFileAsync_PreservesExistingPriceWhenGroupedOfferHasNoValidPrice()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000002", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("No Price Medicine", "NP-1");
    var source = new IntegrationSource(pharmacy.Id, "1c", "nishon_1C", "Nishon 1C", DateTime.UtcNow);
    var link = new ExternalProductLink(
      source.Id,
      pharmacy.Id,
      "1c",
      "no-price-product",
      null,
      "No Price Medicine",
      DateTime.UtcNow);
    link.Confirm(medicine.Id);
    var existingOffer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 2, price: 99m);

    db.AddRange(admin, pharmacy, medicine, source, link, existingOffer);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>no-price-product#stock-only-1</Ид>
              <Количество>4</Количество>
            </Предложение>
            <Предложение>
              <Ид>no-price-product#stock-only-2</Ид>
              <Количество>5</Количество>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var result = await InvokeProcessOffersAsync(db, source, file);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(99m, offer.Price);
    Assert.Equal(9, offer.StockQuantity);
    Assert.Equal(1, Get<int>(result, "Updated"));
    Assert.Equal(0, Get<int>(result, "Inserted"));
  }

  [Fact]
  public async Task ProcessOffersFileAsync_SkipsUnchangedExistingOffer()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000004", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Same Offer Medicine", "SO-1");
    var source = new IntegrationSource(pharmacy.Id, "1c", "nishon_1C", "Nishon 1C", DateTime.UtcNow);
    var link = new ExternalProductLink(
      source.Id,
      pharmacy.Id,
      "1c",
      "same-product",
      null,
      "Same Offer Medicine",
      DateTime.UtcNow);
    link.Confirm(medicine.Id);
    var existingOffer = TestDbFactory.CreateOffer(medicine.Id, pharmacy.Id, stock: 7, price: 42m);

    db.AddRange(admin, pharmacy, medicine, source, link, existingOffer);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>same-product#batch</Ид>
              <Количество>7</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>42</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var result = await InvokeProcessOffersAsync(db, source, file);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(42m, offer.Price);
    Assert.Equal(7, offer.StockQuantity);
    Assert.Equal(0, Get<int>(result, "Updated"));
    Assert.Equal(1, Get<int>(result, "Unchanged"));
  }

  [Fact]
  public async Task ProcessOffersFileAsync_CountsUnmatchedOffersWithoutMedicineLink()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000006", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", admin.Id);
    var source = new IntegrationSource(pharmacy.Id, "1c", "nishon_1C", "Nishon 1C", DateTime.UtcNow);

    db.AddRange(admin, pharmacy, source);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>unknown-product#batch</Ид>
              <Количество>3</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>12</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """);

    var result = await InvokeProcessOffersAsync(db, source, file);

    Assert.Equal(1, Get<int>(result, "Unmatched"));
    Assert.Equal(0, Get<int>(result, "Inserted"));
    Assert.False(await db.Offers.AnyAsync());
  }

  [Fact]
  public async Task RunOnceAsync_ProcessesOnlyLatestCompleteOffersSnapshotAndMarksOlderAsSuperseded()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var directory = Directory.CreateTempSubdirectory("yalla-1c-");
    var sourceDirectory = Directory.CreateDirectory(Path.Combine(directory.FullName, "source-a"));

    var admin = TestDbFactory.CreateUser("Admin", "900000007", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Latest Pharmacy", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Latest Medicine", "LM-1");
    var source = new IntegrationSource(pharmacy.Id, "1c", "source-a", "Source A", DateTime.UtcNow);
    var link = new ExternalProductLink(
      source.Id,
      pharmacy.Id,
      "1c",
      "product-a",
      null,
      "Latest Medicine",
      DateTime.UtcNow);
    link.Confirm(medicine.Id);

    db.AddRange(admin, pharmacy, medicine, source, link);
    await db.SaveChangesAsync();

    var oldFile = Path.Combine(sourceDirectory.FullName, "offers.old.xml");
    var latestFile = Path.Combine(sourceDirectory.FullName, "offers.latest.xml");
    await File.WriteAllTextAsync(oldFile, BuildOffersXml("product-a#old", 1, 10m));
    await File.WriteAllTextAsync(latestFile, BuildOffersXml("product-a#latest", 5, 20m));
    File.SetLastWriteTimeUtc(oldFile, DateTime.UtcNow.AddMinutes(-2));
    File.SetLastWriteTimeUtc(latestFile, DateTime.UtcNow.AddMinutes(-1));

    await InvokeRunOnceAsync(db, directory.FullName);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(5, offer.StockQuantity);
    Assert.Equal(20m, offer.Price);

    var runs = await db.OneCImportRuns.OrderBy(x => x.FileName).ToListAsync();
    Assert.Contains(runs, x => x.FileName == "offers.old.xml" && x.Status == "superseded");
    Assert.Contains(runs, x => x.FileName == "offers.latest.xml" && x.Status == "success");
  }

  [Fact]
  public async Task ProcessOffersFileAsync_IsolatesSameExternalProductIdBySourceAndPharmacy()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var adminA = TestDbFactory.CreateUser("Admin A", "900000008", Role.Admin);
    var adminB = TestDbFactory.CreateUser("Admin B", "900000009", Role.Admin);
    var pharmacyA = TestDbFactory.CreatePharmacy("Pharmacy A", "Dushanbe", adminA.Id);
    var pharmacyB = TestDbFactory.CreatePharmacy("Pharmacy B", "Dushanbe", adminB.Id);
    var medicineA = TestDbFactory.CreateMedicine("Medicine A", "MA-1");
    var medicineB = TestDbFactory.CreateMedicine("Medicine B", "MB-1");
    var sourceA = new IntegrationSource(pharmacyA.Id, "1c", "source-a", "Source A", DateTime.UtcNow);
    var sourceB = new IntegrationSource(pharmacyB.Id, "1c", "source-b", "Source B", DateTime.UtcNow);
    var linkA = new ExternalProductLink(sourceA.Id, pharmacyA.Id, "1c", "shared-product", null, "Medicine A", DateTime.UtcNow);
    var linkB = new ExternalProductLink(sourceB.Id, pharmacyB.Id, "1c", "shared-product", null, "Medicine B", DateTime.UtcNow);
    linkA.Confirm(medicineA.Id);
    linkB.Confirm(medicineB.Id);

    db.AddRange(adminA, adminB, pharmacyA, pharmacyB, medicineA, medicineB, sourceA, sourceB, linkA, linkB);
    await db.SaveChangesAsync();

    var fileA = WriteTempXml(BuildOffersXml("shared-product#a", 3, 11m));
    var fileB = WriteTempXml(BuildOffersXml("shared-product#b", 7, 22m));

    await InvokeProcessOffersAsync(db, sourceA, fileA);
    await InvokeProcessOffersAsync(db, sourceB, fileB);

    var offerA = await db.Offers.SingleAsync(x => x.MedicineId == medicineA.Id && x.PharmacyId == pharmacyA.Id);
    var offerB = await db.Offers.SingleAsync(x => x.MedicineId == medicineB.Id && x.PharmacyId == pharmacyB.Id);
    Assert.Equal(3, offerA.StockQuantity);
    Assert.Equal(11m, offerA.Price);
    Assert.Equal(7, offerB.StockQuantity);
    Assert.Equal(22m, offerB.Price);
  }

  [Fact]
  public async Task ProcessImportFileAsync_DoesNotAutoMatchByExternalIdEvenWhenItMatchesMedicineId1C()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000003", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Nishon", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Legacy Id Medicine", "L-1");
    var legacyId = Guid.NewGuid();
    medicine.SetId1C(legacyId);
    var source = new IntegrationSource(pharmacy.Id, "1c", "nishon_1C", "Nishon 1C", DateTime.UtcNow);

    db.AddRange(admin, pharmacy, medicine, source);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      $$"""
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <Каталог>
          <Товары>
            <Товар>
              <Ид>{{legacyId}}</Ид>
              <Наименование>External product with same 1C id</Наименование>
            </Товар>
          </Товары>
        </Каталог>
      </КоммерческаяИнформация>
      """);

    await InvokeProcessImportAsync(db, source, file);

    var link = await db.ExternalProductLinks.SingleAsync();
    Assert.Null(link.MedicineId);
    Assert.Equal("manual_required", link.MatchStatus);
    Assert.Equal("missing_barcode", link.MatchMethod);
  }

  [Fact]
  public async Task ProcessImportFileAsync_AutoMatchesByUniqueBarcode()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000004", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Relax", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Barcode Medicine", "B-1");
    var source = new IntegrationSource(pharmacy.Id, "1c", "relax_1C", "Relax 1C", DateTime.UtcNow);
    var barcode = new MedicineBarcode(medicine.Id, "460123456789", true, DateTime.UtcNow);

    db.AddRange(admin, pharmacy, medicine, source, barcode);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <Каталог>
          <Товары>
            <Товар>
              <Ид>external-product-id</Ид>
              <Штрихкод>460123456789</Штрихкод>
              <Наименование>External barcode medicine</Наименование>
            </Товар>
          </Товары>
        </Каталог>
      </КоммерческаяИнформация>
      """);

    await InvokeProcessImportAsync(db, source, file);

    var link = await db.ExternalProductLinks.SingleAsync();
    Assert.Equal(medicine.Id, link.MedicineId);
    Assert.Equal("auto_matched", link.MatchStatus);
    Assert.Equal("barcode", link.MatchMethod);
  }

  [Fact]
  public async Task ProcessImportFileAsync_AutoMatchesByCanonicalMedicineBarcode()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var admin = TestDbFactory.CreateUser("Admin", "900000005", Role.Admin);
    var pharmacy = TestDbFactory.CreatePharmacy("Relax", "Dushanbe", admin.Id);
    var medicine = TestDbFactory.CreateMedicine("Canonical Barcode Medicine", "CB-1", barcode: "460123456789");
    var source = new IntegrationSource(pharmacy.Id, "1c", "relax_1C", "Relax 1C", DateTime.UtcNow);

    db.AddRange(admin, pharmacy, medicine, source);
    await db.SaveChangesAsync();

    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <Каталог>
          <Товары>
            <Товар>
              <Ид>external-product-id</Ид>
              <Штрихкод>460123456789</Штрихкод>
              <Наименование>External barcode medicine</Наименование>
            </Товар>
          </Товары>
        </Каталог>
      </КоммерческаяИнформация>
      """);

    await InvokeProcessImportAsync(db, source, file);

    var link = await db.ExternalProductLinks.SingleAsync();
    Assert.Equal(medicine.Id, link.MedicineId);
    Assert.Equal("auto_matched", link.MatchStatus);
    Assert.Equal("barcode", link.MatchMethod);
  }

  [Fact]
  public void ParseProducts_HandlesCommerceMlNamespaceAndNormalizesBarcode()
  {
    var file = WriteTempXml(
      """
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <Каталог>
          <Товары>
            <Товар>
              <Ид>external-product-id</Ид>
              <Штрихкод> 46 0123-456789 </Штрихкод>
              <Наименование>Test product</Наименование>
            </Товар>
          </Товары>
        </Каталог>
      </КоммерческаяИнформация>
      """);

    var products = InvokeParser("ParseProducts", file);

    var product = Assert.Single(products);
    Assert.Equal("external-product-id", Get<string>(product, "ExternalId"));
    Assert.Equal("460123456789", Get<string>(product, "Barcode"));
    Assert.Equal("Test product", Get<string>(product, "Title"));
  }

  [Fact]
  public async Task FindLatestReadyFileAsync_IgnoresNewerIncompleteSnapshotAndUsesOlderCompleteFile()
  {
    var directory = Directory.CreateTempSubdirectory("yalla-1c-");
    var incomplete = Path.Combine(directory.FullName, "import.new.xml");
    var complete = Path.Combine(directory.FullName, "import.old.xml");

    await File.WriteAllTextAsync(incomplete, "<КоммерческаяИнформация><Каталог>");
    await File.WriteAllTextAsync(complete, "<КоммерческаяИнформация></КоммерческаяИнформация>");
    File.SetLastWriteTimeUtc(complete, DateTime.UtcNow.AddMinutes(-2));
    File.SetLastWriteTimeUtc(incomplete, DateTime.UtcNow.AddMinutes(-1));

    var service = new OneCImportHostedService(
      new ThrowingScopeFactory(),
      Options.Create(new OneCImportOptions { StableFileSeconds = 1 }),
      NullLogger<OneCImportHostedService>.Instance);

    var method = typeof(OneCImportHostedService).GetMethod(
      "FindLatestReadyFileAsync",
      BindingFlags.Instance | BindingFlags.NonPublic);

    Assert.NotNull(method);
    var task = (Task<FileInfo?>)method.Invoke(service, [directory, "import", CancellationToken.None])!;
    var result = await task;

    Assert.NotNull(result);
    Assert.Equal("import.old.xml", result.Name);
  }

  private static IReadOnlyList<object> InvokeParser(string methodName, string file)
  {
    var method = typeof(OneCImportHostedService).GetMethod(
      methodName,
      BindingFlags.Static | BindingFlags.NonPublic);

    Assert.NotNull(method);
    var enumerable = (System.Collections.IEnumerable)method.Invoke(null, [file])!;
    return enumerable.Cast<object>().ToList();
  }

  private static async Task InvokeRunOnceAsync(AppDbContext db, string exchangeDirectory)
  {
    using var provider = new ServiceCollection()
      .AddSingleton(db)
      .BuildServiceProvider();

    var service = new OneCImportHostedService(
      provider.GetRequiredService<IServiceScopeFactory>(),
      Options.Create(new OneCImportOptions
      {
        Enabled = true,
        ExchangeDirectory = exchangeDirectory,
        StableFileSeconds = 1
      }),
      NullLogger<OneCImportHostedService>.Instance);

    var method = typeof(OneCImportHostedService).GetMethod(
      "RunOnceAsync",
      BindingFlags.Instance | BindingFlags.NonPublic);

    Assert.NotNull(method);
    var task = (Task)method.Invoke(service, [CancellationToken.None])!;
    await task;
  }

  private static async Task<object> InvokeProcessOffersAsync(AppDbContext db, IntegrationSource source, string file)
  {
    var service = new OneCImportHostedService(
      new ThrowingScopeFactory(),
      Options.Create(new OneCImportOptions()),
      NullLogger<OneCImportHostedService>.Instance);

    var method = typeof(OneCImportHostedService).GetMethod(
      "ProcessOffersFileAsync",
      BindingFlags.Instance | BindingFlags.NonPublic);

    Assert.NotNull(method);
    var task = method.Invoke(service, [db, source, file, CancellationToken.None])!;
    await (Task)task;
    return task.GetType().GetProperty("Result")!.GetValue(task)!;
  }

  private static async Task InvokeProcessImportAsync(AppDbContext db, IntegrationSource source, string file)
  {
    var service = new OneCImportHostedService(
      new ThrowingScopeFactory(),
      Options.Create(new OneCImportOptions()),
      NullLogger<OneCImportHostedService>.Instance);

    var method = typeof(OneCImportHostedService).GetMethod(
      "ProcessImportFileAsync",
      BindingFlags.Instance | BindingFlags.NonPublic);

    Assert.NotNull(method);
    var task = (Task)method.Invoke(service, [db, source, file, CancellationToken.None])!;
    await task;
  }

  private static T Get<T>(object target, string propertyName)
  {
    var property = target.GetType().GetProperty(propertyName);
    Assert.NotNull(property);
    return Assert.IsAssignableFrom<T>(property.GetValue(target));
  }

  private static object? GetRaw(object target, string propertyName)
  {
    var property = target.GetType().GetProperty(propertyName);
    Assert.NotNull(property);
    return property.GetValue(target);
  }

  private static string WriteTempXml(string content)
  {
    var file = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xml");
    File.WriteAllText(file, content);
    return file;
  }

  private static string BuildOffersXml(string offerId, int stock, decimal price)
  {
    return $$"""
      <?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2">
        <ПакетПредложений>
          <Предложения>
            <Предложение>
              <Ид>{{offerId}}</Ид>
              <Количество>{{stock}}</Количество>
              <Цены>
                <Цена>
                  <ЦенаЗаЕдиницу>{{price.ToString(CultureInfo.InvariantCulture)}}</ЦенаЗаЕдиницу>
                </Цена>
              </Цены>
            </Предложение>
          </Предложения>
        </ПакетПредложений>
      </КоммерческаяИнформация>
      """;
  }

  private sealed class ThrowingScopeFactory : IServiceScopeFactory
  {
    public IServiceScope CreateScope() => throw new NotSupportedException();
  }
}
