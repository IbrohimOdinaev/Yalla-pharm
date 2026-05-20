using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
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

  private static T Get<T>(object target, string propertyName)
  {
    var property = target.GetType().GetProperty(propertyName);
    Assert.NotNull(property);
    return Assert.IsType<T>(property.GetValue(target));
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
