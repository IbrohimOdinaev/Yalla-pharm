using System.Reflection;
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

    await InvokeProcessOffersAsync(db, source, file);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(68m, offer.Price);
    Assert.Equal(8, offer.StockQuantity);
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

    await InvokeProcessOffersAsync(db, source, file);

    var offer = await db.Offers.SingleAsync(x => x.MedicineId == medicine.Id && x.PharmacyId == pharmacy.Id);
    Assert.Equal(99m, offer.Price);
    Assert.Equal(9, offer.StockQuantity);
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

  private static async Task InvokeProcessOffersAsync(AppDbContext db, IntegrationSource source, string file)
  {
    var service = new OneCImportHostedService(
      new ThrowingScopeFactory(),
      Options.Create(new OneCImportOptions()),
      NullLogger<OneCImportHostedService>.Instance);

    var method = typeof(OneCImportHostedService).GetMethod(
      "ProcessOffersFileAsync",
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

  private sealed class ThrowingScopeFactory : IServiceScopeFactory
  {
    public IServiceScope CreateScope() => throw new NotSupportedException();
  }
}
