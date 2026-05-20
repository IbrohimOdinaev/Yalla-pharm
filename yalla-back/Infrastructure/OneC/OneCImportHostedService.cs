using System.Globalization;
using System.Xml;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.OneC;

public sealed class OneCImportHostedService : BackgroundService
{
  private const string SourceType = "1c";

  private readonly IServiceScopeFactory _scopeFactory;
  private readonly OneCImportOptions _options;
  private readonly ILogger<OneCImportHostedService> _logger;

  public OneCImportHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<OneCImportOptions> options,
    ILogger<OneCImportHostedService> logger)
  {
    _scopeFactory = scopeFactory;
    _options = options.Value;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    if (!_options.Enabled)
    {
      _logger.LogInformation("1C import disabled: Enabled=false");
      return;
    }

    var interval = TimeSpan.FromSeconds(Math.Max(_options.PollIntervalSeconds, 10));
    _logger.LogInformation("1C import worker started. Directory={Directory}, Interval={Interval}",
      _options.ExchangeDirectory, interval);

    while (!stoppingToken.IsCancellationRequested)
    {
      try
      {
        await RunOnceAsync(stoppingToken);
      }
      catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
      {
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "1C import worker failed");
      }

      await Task.Delay(interval, stoppingToken);
    }
  }

  private async Task RunOnceAsync(CancellationToken ct)
  {
    if (!Directory.Exists(_options.ExchangeDirectory))
    {
      _logger.LogWarning("1C import skipped: directory not found: {Directory}", _options.ExchangeDirectory);
      return;
    }

    using var scope = _scopeFactory.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    foreach (var context in await ResolveSourceContextsAsync(db, ct))
    {
      var importFile = await FindLatestReadyFileAsync(context.Directory, "import", ct);
      if (importFile != null)
        await ProcessFileIfNeededAsync(db, context.Source, importFile, "import", ct);

      var offersFile = await FindLatestReadyFileAsync(context.Directory, "offers", ct);
      if (offersFile != null)
        await ProcessFileIfNeededAsync(db, context.Source, offersFile, "offers", ct);
    }
  }

  private async Task<List<SourceContext>> ResolveSourceContextsAsync(AppDbContext db, CancellationToken ct)
  {
    var contexts = new List<SourceContext>();
    var root = new DirectoryInfo(_options.ExchangeDirectory);
    var defaultSource = await EnsureDefaultSourceAsync(db, warnWhenMissing: false, ct);

    var rootHasXml = root.EnumerateFiles("*.xml").Any();
    if (rootHasXml)
    {
      if (defaultSource != null)
        contexts.Add(new SourceContext(defaultSource, root));
      else
        _logger.LogWarning("1C root import skipped: DefaultPharmacyId or DefaultSourceToken is not configured");
    }

    var activeSources = await db.IntegrationSources
      .AsTracking()
      .Where(x => x.Type == SourceType && x.IsActive)
      .ToDictionaryAsync(x => x.Token, ct);

    foreach (var directory in root.EnumerateDirectories())
    {
      if (!activeSources.TryGetValue(directory.Name, out var source))
      {
        _logger.LogWarning("1C import skipped unknown source token directory: {Directory}", directory.FullName);
        continue;
      }

      contexts.Add(new SourceContext(source, directory));
    }

    return contexts;
  }

  private async Task<IntegrationSource?> EnsureDefaultSourceAsync(AppDbContext db, bool warnWhenMissing, CancellationToken ct)
  {
    if (_options.DefaultPharmacyId == Guid.Empty || string.IsNullOrWhiteSpace(_options.DefaultSourceToken))
    {
      if (warnWhenMissing)
        _logger.LogWarning("1C root import skipped: DefaultPharmacyId or DefaultSourceToken is not configured");
      return null;
    }

    var token = _options.DefaultSourceToken.Trim();
    var source = await db.IntegrationSources
      .FirstOrDefaultAsync(x => x.Token == token, ct);

    if (source != null)
      return source;

    source = new IntegrationSource(
      _options.DefaultPharmacyId,
      SourceType,
      token,
      _options.DefaultSourceName,
      DateTime.UtcNow);
    db.IntegrationSources.Add(source);
    await db.SaveChangesAsync(ct);
    return source;
  }

  private async Task<FileInfo?> FindLatestReadyFileAsync(DirectoryInfo directory, string prefix, CancellationToken ct)
  {
    var candidates = directory
      .EnumerateFiles($"{prefix}*.xml")
      .OrderByDescending(x => x.LastWriteTimeUtc)
      .ToList();

    foreach (var candidate in candidates)
    {
      var stableFor = DateTime.UtcNow - candidate.LastWriteTimeUtc;
      if (stableFor < TimeSpan.FromSeconds(Math.Max(_options.StableFileSeconds, 5)))
        continue;

      if (await LooksCompleteXmlAsync(candidate, ct))
        return candidate;

      _logger.LogWarning("1C import ignored incomplete XML snapshot: {File}", candidate.FullName);
    }

    return null;
  }

  private static async Task<bool> LooksCompleteXmlAsync(FileInfo file, CancellationToken ct)
  {
    if (!file.Exists || file.Length == 0)
      return false;

    var tailLength = (int)Math.Min(file.Length, 8192);
    var buffer = new byte[tailLength];
    await using var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    stream.Seek(-tailLength, SeekOrigin.End);
    var read = await stream.ReadAsync(buffer.AsMemory(0, tailLength), ct);
    var tail = System.Text.Encoding.UTF8.GetString(buffer, 0, read);
    return tail.Contains("</КоммерческаяИнформация>", StringComparison.Ordinal);
  }

  private async Task ProcessFileIfNeededAsync(
    AppDbContext db,
    IntegrationSource source,
    FileInfo file,
    string kind,
    CancellationToken ct)
  {
    file.Refresh();
    var signature = $"{file.Name}:{file.Length}:{file.LastWriteTimeUtc.Ticks}";
    var alreadySucceeded = await db.OneCImportRuns
      .AnyAsync(x => x.SourceId == source.Id && x.FileSignature == signature && x.Status == "success", ct);
    if (alreadySucceeded)
      return;

    var run = new OneCImportRun(source.Id, kind, file.Name, file.Length, signature, DateTime.UtcNow);
    db.OneCImportRuns.Add(run);
    await db.SaveChangesAsync(ct);

    try
    {
      var result = kind == "import"
        ? await ProcessImportFileAsync(db, source, file.FullName, ct)
        : await ProcessOffersFileAsync(db, source, file.FullName, ct);

      run.Complete(result.Processed, result.Linked, result.Updated, result.Unmatched, DateTime.UtcNow);
      await db.SaveChangesAsync(ct);
      _logger.LogInformation("1C {Kind} import success: processed={Processed}, linked={Linked}, updated={Updated}, unmatched={Unmatched}, file={File}",
        kind, result.Processed, result.Linked, result.Updated, result.Unmatched, file.Name);
    }
    catch (Exception ex)
    {
      run.Fail(ex.Message, DateTime.UtcNow);
      await db.SaveChangesAsync(ct);
      _logger.LogError(ex, "1C {Kind} import failed for {File}", kind, file.FullName);
    }
  }

  private async Task<ImportResult> ProcessImportFileAsync(
    AppDbContext db,
    IntegrationSource source,
    string filePath,
    CancellationToken ct)
  {
    var products = ParseProducts(filePath).ToList();
    if (products.Count == 0)
      return ImportResult.Empty;

    var externalIds = products.Select(x => x.ExternalId).Distinct().ToList();
    var barcodes = products.Select(x => x.Barcode).Where(x => x != null).Select(x => x!).Distinct().ToList();
    var legacy1CIds = products
      .Select(x => Guid.TryParse(x.ExternalId, out var id) ? id : Guid.Empty)
      .Where(x => x != Guid.Empty)
      .Distinct()
      .ToList();

    var existingLinks = await db.ExternalProductLinks
      .AsTracking()
      .Where(x => x.SourceId == source.Id && externalIds.Contains(x.ExternalProductId))
      .ToDictionaryAsync(x => x.ExternalProductId, ct);

    var legacyMedicines = await db.Medicines
      .AsNoTracking()
      .Where(x => x.Id1C.HasValue && legacy1CIds.Contains(x.Id1C.Value))
      .ToDictionaryAsync(x => x.Id1C!.Value, x => x.Id, ct);

    var barcodeRows = await db.MedicineBarcodes
      .AsNoTracking()
      .Where(x => barcodes.Contains(x.Barcode))
      .Select(x => new { x.Barcode, x.MedicineId })
      .ToListAsync(ct);

    var uniqueBarcodeMatches = barcodeRows
      .GroupBy(x => x.Barcode)
      .Where(g => g.Select(x => x.MedicineId).Distinct().Count() == 1)
      .ToDictionary(g => g.Key, g => g.First().MedicineId);

    var linkedPairs = new List<(Guid MedicineId, string Barcode)>();
    var linked = 0;
    var updated = 0;
    var unmatched = 0;

    foreach (var product in products)
    {
      if (!existingLinks.TryGetValue(product.ExternalId, out var link))
      {
        link = new ExternalProductLink(
          source.Id,
          source.PharmacyId,
          SourceType,
          product.ExternalId,
          product.Barcode,
          product.Title,
          DateTime.UtcNow);
        db.ExternalProductLinks.Add(link);
        existingLinks[product.ExternalId] = link;
        linked++;
      }
      else
      {
        link.UpdateExternalSnapshot(product.Barcode, product.Title, DateTime.UtcNow);
        updated++;
      }

      if (!link.MedicineId.HasValue)
      {
        if (Guid.TryParse(product.ExternalId, out var legacyId) && legacyMedicines.TryGetValue(legacyId, out var legacyMedicineId))
        {
          link.AutoMatch(legacyMedicineId, "legacy_id_1c", 1m);
        }
        else if (product.Barcode != null && uniqueBarcodeMatches.TryGetValue(product.Barcode, out var barcodeMedicineId))
        {
          link.AutoMatch(barcodeMedicineId, "barcode", 0.98m);
        }
        else
        {
          link.RequireManualReview(product.Barcode == null ? "missing_barcode" : "barcode_not_found_or_not_unique");
          unmatched++;
        }
      }

      if (link.MedicineId.HasValue && product.Barcode != null)
        linkedPairs.Add((link.MedicineId.Value, product.Barcode));
    }

    await UpsertMedicineBarcodesAsync(db, linkedPairs, ct);
    await db.SaveChangesAsync(ct);
    return new ImportResult(products.Count, linked, updated, unmatched);
  }

  private async Task UpsertMedicineBarcodesAsync(
    AppDbContext db,
    List<(Guid MedicineId, string Barcode)> pairs,
    CancellationToken ct)
  {
    var uniquePairs = pairs.Distinct().ToList();
    if (uniquePairs.Count == 0)
      return;

    var medicineIds = uniquePairs.Select(x => x.MedicineId).Distinct().ToList();
    var barcodes = uniquePairs.Select(x => x.Barcode).Distinct().ToList();

    var existing = await db.MedicineBarcodes
      .AsTracking()
      .Where(x => medicineIds.Contains(x.MedicineId) && barcodes.Contains(x.Barcode))
      .ToListAsync(ct);

    var existingSet = existing.Select(x => (x.MedicineId, x.Barcode)).ToHashSet();
    var now = DateTime.UtcNow;
    foreach (var row in existing)
      row.MarkSeen(now);

    foreach (var pair in uniquePairs)
    {
      if (existingSet.Contains(pair))
        continue;

      db.MedicineBarcodes.Add(new MedicineBarcode(pair.MedicineId, pair.Barcode, false, now));
    }
  }

  private async Task<ImportResult> ProcessOffersFileAsync(
    AppDbContext db,
    IntegrationSource source,
    string filePath,
    CancellationToken ct)
  {
    var incomingOffers = ParseOffers(filePath).ToList();
    if (incomingOffers.Count == 0)
      return ImportResult.Empty;

    var externalIds = incomingOffers.Select(x => x.ExternalProductId).Distinct().ToList();
    var links = await db.ExternalProductLinks
      .AsNoTracking()
      .Where(x => x.SourceId == source.Id && externalIds.Contains(x.ExternalProductId) && x.MedicineId.HasValue)
      .ToDictionaryAsync(x => x.ExternalProductId, x => x.MedicineId!.Value, ct);

    var medicineIds = links.Values.Distinct().ToList();
    var existingOffers = await db.Offers
      .AsTracking()
      .Where(x => x.PharmacyId == source.PharmacyId && medicineIds.Contains(x.MedicineId))
      .ToDictionaryAsync(x => x.MedicineId, ct);

    var updated = 0;
    var unmatched = 0;
    foreach (var incoming in incomingOffers)
    {
      if (!links.TryGetValue(incoming.ExternalProductId, out var medicineId))
      {
        unmatched++;
        continue;
      }

      if (existingOffers.TryGetValue(medicineId, out var offer))
      {
        offer.SetPrice(incoming.Price);
        offer.SetStockQuantity(incoming.Stock);
      }
      else
      {
        offer = new Offer(medicineId, source.PharmacyId, incoming.Stock, incoming.Price);
        db.Offers.Add(offer);
        existingOffers[medicineId] = offer;
      }
      updated++;
    }

    await db.SaveChangesAsync(ct);
    return new ImportResult(incomingOffers.Count, 0, updated, unmatched);
  }

  private static IEnumerable<OneCProduct> ParseProducts(string filePath)
  {
    foreach (var element in ReadElements(filePath, "Товар"))
    {
      var id = CleanText(ChildValue(element, "Ид"));
      if (string.IsNullOrWhiteSpace(id))
        continue;

      yield return new OneCProduct(
        id,
        NormalizeBarcode(ChildValue(element, "Штрихкод")),
        CleanText(ChildValue(element, "Наименование")));
    }
  }

  private static IEnumerable<OneCOffer> ParseOffers(string filePath)
  {
    foreach (var element in ReadElements(filePath, "Предложение"))
    {
      var rawId = CleanText(ChildValue(element, "Ид"));
      if (string.IsNullOrWhiteSpace(rawId))
        continue;

      var externalProductId = rawId.Split('#', 2)[0].Trim();
      if (string.IsNullOrWhiteSpace(externalProductId))
        continue;

      var priceText = ChildrenByLocalName(element, "Цены")
        .SelectMany(x => ChildrenByLocalName(x, "Цена"))
        .Select(x => ChildValue(x, "ЦенаЗаЕдиницу"))
        .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

      if (!TryParseDecimal(priceText, out var price))
        continue;

      var stock = ParseStock(element);
      yield return new OneCOffer(externalProductId, price, stock);
    }
  }

  private static IEnumerable<XElement> ReadElements(string filePath, string elementName)
  {
    var settings = new XmlReaderSettings
    {
      DtdProcessing = DtdProcessing.Prohibit,
      IgnoreComments = true,
      IgnoreWhitespace = true
    };

    using var reader = XmlReader.Create(filePath, settings);
    while (reader.Read())
    {
      if (reader.NodeType != XmlNodeType.Element || reader.LocalName != elementName)
        continue;

      using var subtree = reader.ReadSubtree();
      subtree.MoveToContent();
      yield return XElement.Load(subtree);
    }
  }

  private static int ParseStock(XElement element)
  {
    var warehouseStock = ChildrenByLocalName(element, "Склад", "Склады")
      .Select(x => AttributeValue(x, "КоличествоНаСкладе"))
      .Where(x => !string.IsNullOrWhiteSpace(x))
      .Aggregate(0m, (sum, raw) => TryParseDecimal(raw, out var stock) ? sum + stock : sum);

    if (warehouseStock > 0m)
      return Math.Max(0, (int)Math.Floor(warehouseStock));

    var quantityText = ChildValue(element, "Количество");
    if (TryParseDecimal(quantityText, out var stockFromQuantity))
      return Math.Max(0, (int)Math.Floor(stockFromQuantity));

    return 0;
  }

  private static bool TryParseDecimal(string? value, out decimal result)
  {
    result = 0m;
    if (string.IsNullOrWhiteSpace(value))
      return false;

    var normalized = value.Trim().Replace(',', '.');
    return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out result);
  }

  private static string? NormalizeBarcode(string? value)
  {
    var cleaned = CleanText(value);
    if (string.IsNullOrWhiteSpace(cleaned))
      return null;

    var digits = new string(cleaned.Where(char.IsDigit).ToArray());
    return digits.Length == 0 ? null : digits;
  }

  private static string? CleanText(string? value)
  {
    return string.IsNullOrWhiteSpace(value)
      ? null
      : value.Replace("\0", string.Empty).Trim();
  }

  private static string? ChildValue(XElement element, string localName)
  {
    return ChildrenByLocalName(element, localName).FirstOrDefault()?.Value;
  }

  private static IEnumerable<XElement> ChildrenByLocalName(XElement element, params string[] localNames)
  {
    return element.Elements()
      .Where(x => localNames.Contains(x.Name.LocalName, StringComparer.Ordinal));
  }

  private static string? AttributeValue(XElement element, string localName)
  {
    return element.Attributes()
      .FirstOrDefault(x => string.Equals(x.Name.LocalName, localName, StringComparison.Ordinal))
      ?.Value;
  }

  private sealed record OneCProduct(string ExternalId, string? Barcode, string? Title);
  private sealed record OneCOffer(string ExternalProductId, decimal Price, int Stock);
  private sealed record SourceContext(IntegrationSource Source, DirectoryInfo Directory);
  private sealed record ImportResult(int Processed, int Linked, int Updated, int Unmatched)
  {
    public static ImportResult Empty => new(0, 0, 0, 0);
  }
}
