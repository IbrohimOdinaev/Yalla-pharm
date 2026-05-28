using System.Globalization;
using System.Data;
using System.Xml;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using NpgsqlTypes;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;

namespace Yalla.Infrastructure.OneC;

public sealed class OneCImportHostedService : BackgroundService
{
  private const string SourceType = "1c";
  private static readonly TimeSpan NomenclatureMinInterval = TimeSpan.FromDays(1);

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
    var realtime = scope.ServiceProvider.GetService<IRealtimeUpdatesPublisher>();

    foreach (var context in await ResolveSourceContextsAsync(db, ct))
    {
      var importFile = await FindLatestReadyFileAsync(context.Directory, "import", ct);
      if (importFile != null && await ShouldProcessNomenclatureImportAsync(db, context.Source, ct))
        await ProcessFileIfNeededAsync(db, realtime, context.Source, importFile, "import", ct);

      var readyOfferFiles = await FindReadyFilesAsync(context.Directory, "offers", ct);
      var offersFile = readyOfferFiles.FirstOrDefault();
      if (offersFile != null)
      {
        await MarkSupersededOffersAsync(db, realtime, context.Source, readyOfferFiles.Skip(1), offersFile, ct);
        await ProcessFileIfNeededAsync(db, realtime, context.Source, offersFile, "offers", ct);
      }
    }
  }

  private async Task<bool> ShouldProcessNomenclatureImportAsync(
    AppDbContext db,
    IntegrationSource source,
    CancellationToken ct)
  {
    var lastSuccessfulImportAtUtc = await db.OneCImportRuns
      .AsNoTracking()
      .Where(x => x.SourceId == source.Id
        && x.FileKind == "import"
        && x.Status == "success")
      .OrderByDescending(x => x.FinishedAtUtc ?? x.StartedAtUtc)
      .Select(x => x.FinishedAtUtc ?? x.StartedAtUtc)
      .FirstOrDefaultAsync(ct);

    if (lastSuccessfulImportAtUtc == default)
      return true;

    var nextAllowedAtUtc = lastSuccessfulImportAtUtc.Add(NomenclatureMinInterval);
    if (DateTime.UtcNow >= nextAllowedAtUtc)
      return true;

    _logger.LogDebug(
      "1C nomenclature import throttled. SourceId={SourceId}, LastSuccessAtUtc={LastSuccessAtUtc}, NextAllowedAtUtc={NextAllowedAtUtc}",
      source.Id,
      lastSuccessfulImportAtUtc,
      nextAllowedAtUtc);
    return false;
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
        _logger.LogWarning("1C root import skipped: DefaultPharmacyId is invalid or DefaultSourceToken is not configured");
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
    if (!Guid.TryParse(_options.DefaultPharmacyId, out var defaultPharmacyId)
      || defaultPharmacyId == Guid.Empty
      || string.IsNullOrWhiteSpace(_options.DefaultSourceToken))
    {
      if (warnWhenMissing)
        _logger.LogWarning("1C root import skipped: DefaultPharmacyId is invalid or DefaultSourceToken is not configured");
      return null;
    }

    var token = _options.DefaultSourceToken.Trim();
    var source = await db.IntegrationSources
      .FirstOrDefaultAsync(x => x.Token == token, ct);

    if (source != null)
      return source;

    source = new IntegrationSource(
      defaultPharmacyId,
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
    return (await FindReadyFilesAsync(directory, prefix, ct)).FirstOrDefault();
  }

  private async Task<List<FileInfo>> FindReadyFilesAsync(DirectoryInfo directory, string prefix, CancellationToken ct)
  {
    var candidates = directory
      .EnumerateFiles($"{prefix}*.xml")
      .OrderByDescending(x => x.LastWriteTimeUtc)
      .ToList();

    var ready = new List<FileInfo>();
    foreach (var candidate in candidates)
    {
      var stableFor = DateTime.UtcNow - candidate.LastWriteTimeUtc;
      if (stableFor < TimeSpan.FromSeconds(Math.Max(_options.StableFileSeconds, 5)))
        continue;

      if (await LooksCompleteXmlAsync(candidate, ct))
      {
        ready.Add(candidate);
        continue;
      }

      _logger.LogWarning("1C import ignored incomplete XML snapshot: {File}", candidate.FullName);
    }

    return ready;
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
    IRealtimeUpdatesPublisher? realtime,
    IntegrationSource source,
    FileInfo file,
    string kind,
    CancellationToken ct)
  {
    file.Refresh();
    var signature = $"{file.Name}:{file.Length}:{file.LastWriteTimeUtc.Ticks}";
    var alreadyHandled = await db.OneCImportRuns
      .AnyAsync(x => x.SourceId == source.Id
        && x.FileSignature == signature
        && (x.Status == "success" || x.Status == "superseded"), ct);
    if (alreadyHandled)
      return;

    var run = new OneCImportRun(source.Id, kind, file.Name, file.Length, signature, DateTime.UtcNow);
    db.OneCImportRuns.Add(run);
    await db.SaveChangesAsync(ct);
    await PublishRunUpdatedAsync(db, realtime, source, run, ct);

    try
    {
      var result = kind == "import"
        ? await ProcessImportFileAsync(db, source, file.FullName, ct)
        : await ProcessOffersFileAsync(db, source, file.FullName, ct);

      run.Complete(result.Processed, result.Linked, result.Updated, result.Inserted, result.Unchanged, result.Unmatched, DateTime.UtcNow);
      await db.SaveChangesAsync(ct);
      await PublishRunUpdatedAsync(db, realtime, source, run, ct);
      _logger.LogInformation("1C {Kind} import success: processed={Processed}, linked={Linked}, updated={Updated}, inserted={Inserted}, unchanged={Unchanged}, unmatched={Unmatched}, file={File}",
        kind, result.Processed, result.Linked, result.Updated, result.Inserted, result.Unchanged, result.Unmatched, file.Name);
    }
    catch (Exception ex)
    {
      run.Fail(ex.Message, DateTime.UtcNow);
      await db.SaveChangesAsync(ct);
      await PublishRunUpdatedAsync(db, realtime, source, run, ct);
      _logger.LogError(ex, "1C {Kind} import failed for {File}", kind, file.FullName);
    }
  }

  private async Task MarkSupersededOffersAsync(
    AppDbContext db,
    IRealtimeUpdatesPublisher? realtime,
    IntegrationSource source,
    IEnumerable<FileInfo> files,
    FileInfo latestFile,
    CancellationToken ct)
  {
    foreach (var file in files)
    {
      file.Refresh();
      var signature = $"{file.Name}:{file.Length}:{file.LastWriteTimeUtc.Ticks}";
      var alreadyHandled = await db.OneCImportRuns
        .AnyAsync(x => x.SourceId == source.Id
          && x.FileSignature == signature
          && (x.Status == "success" || x.Status == "superseded"), ct);
      if (alreadyHandled)
        continue;

      var run = new OneCImportRun(source.Id, "offers", file.Name, file.Length, signature, DateTime.UtcNow);
      run.Supersede($"Superseded by newer complete offers snapshot '{latestFile.Name}'.", DateTime.UtcNow);
      db.OneCImportRuns.Add(run);
      await db.SaveChangesAsync(ct);
      await PublishRunUpdatedAsync(db, realtime, source, run, ct);
      _logger.LogInformation("1C offers import superseded old snapshot: file={File}, latest={LatestFile}",
        file.Name, latestFile.Name);
    }
  }

  private static async Task PublishRunUpdatedAsync(
    AppDbContext db,
    IRealtimeUpdatesPublisher? realtime,
    IntegrationSource source,
    OneCImportRun run,
    CancellationToken ct)
  {
    if (realtime == null)
      return;

    var pharmacyTitle = await db.Pharmacies
      .AsNoTracking()
      .Where(x => x.Id == source.PharmacyId)
      .Select(x => x.Title)
      .FirstOrDefaultAsync(ct) ?? source.Name;

    await realtime.PublishOneCImportRunUpdatedAsync(new OneCImportRunLogResponse(
      run.Id,
      run.SourceId,
      source.PharmacyId,
      source.Token,
      source.Name,
      pharmacyTitle,
      run.FileKind,
      run.FileName,
      run.FileSize,
      run.Status,
      run.ProcessedCount,
      run.LinkedCount,
      run.UpdatedCount,
      run.InsertedCount,
      run.UnchangedCount,
      run.UnmatchedCount,
      run.Error,
      run.StartedAtUtc,
      run.FinishedAtUtc), ct);
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

    var existingLinks = await db.ExternalProductLinks
      .AsTracking()
      .Where(x => x.SourceId == source.Id && externalIds.Contains(x.ExternalProductId))
      .ToDictionaryAsync(x => x.ExternalProductId, ct);

    var canonicalBarcodeRows = await db.Medicines
      .AsNoTracking()
      .Where(x => x.Barcode != null && barcodes.Contains(x.Barcode))
      .Select(x => new { Barcode = x.Barcode!, MedicineId = x.Id })
      .ToListAsync(ct);

    var aliasBarcodeRows = await db.MedicineBarcodes
      .AsNoTracking()
      .Where(x => barcodes.Contains(x.Barcode))
      .Select(x => new { x.Barcode, x.MedicineId })
      .ToListAsync(ct);

    var uniqueBarcodeMatches = canonicalBarcodeRows
      .Concat(aliasBarcodeRows)
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
        if (product.Barcode != null && uniqueBarcodeMatches.TryGetValue(product.Barcode, out var barcodeMedicineId))
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

    var barcodes = uniquePairs.Select(x => x.Barcode).Distinct().ToList();

    var existing = await db.MedicineBarcodes
      .AsTracking()
      .Where(x => barcodes.Contains(x.Barcode))
      .ToListAsync(ct);

    var existingSet = existing.Select(x => (x.MedicineId, x.Barcode)).ToHashSet();
    var existingBarcodeOwners = existing
      .GroupBy(x => x.Barcode)
      .ToDictionary(x => x.Key, x => x.Select(y => y.MedicineId).Distinct().ToHashSet());
    var now = DateTime.UtcNow;
    foreach (var row in existing)
      row.MarkSeen(now);

    foreach (var pair in uniquePairs)
    {
      if (existingSet.Contains(pair))
        continue;

      if (existingBarcodeOwners.TryGetValue(pair.Barcode, out var owners) && !owners.Contains(pair.MedicineId))
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

    if (string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.Ordinal))
      return await BulkUpsertOffersAsync(db, source, incomingOffers, ct);

    return await UpsertOffersWithEfAsync(db, source, incomingOffers, ct);
  }

  private static async Task<ImportResult> UpsertOffersWithEfAsync(
    AppDbContext db,
    IntegrationSource source,
    IReadOnlyList<OneCOffer> incomingOffers,
    CancellationToken ct)
  {
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
    var inserted = 0;
    var unchanged = 0;
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
        var nextPrice = incoming.Price ?? offer.Price;
        if (offer.StockQuantity == incoming.Stock && offer.Price == nextPrice)
        {
          unchanged++;
          continue;
        }

        if (offer.Price != nextPrice)
          offer.SetPrice(nextPrice);
        if (offer.StockQuantity != incoming.Stock)
          offer.SetStockQuantity(incoming.Stock);
        updated++;
      }
      else
      {
        offer = new Offer(medicineId, source.PharmacyId, incoming.Stock, incoming.Price ?? 0m);
        db.Offers.Add(offer);
        existingOffers[medicineId] = offer;
        inserted++;
      }
    }

    await db.SaveChangesAsync(ct);
    return new ImportResult(incomingOffers.Count, 0, updated, unmatched, inserted, unchanged);
  }

  private static async Task<ImportResult> BulkUpsertOffersAsync(
    AppDbContext db,
    IntegrationSource source,
    IReadOnlyList<OneCOffer> incomingOffers,
    CancellationToken ct)
  {
    var runId = Guid.NewGuid();
    var wasClosed = db.Database.GetDbConnection().State == ConnectionState.Closed;
    if (wasClosed)
      await db.Database.OpenConnectionAsync(ct);

    await using var transaction = await db.Database.BeginTransactionAsync(ct);
    try
    {
      await db.Database.ExecuteSqlRawAsync(
        """
        CREATE TEMP TABLE one_c_offer_staging
        (
          offer_id uuid NOT NULL,
          run_id uuid NOT NULL,
          source_id uuid NOT NULL,
          pharmacy_id uuid NOT NULL,
          external_product_id character varying(128) NOT NULL,
          price numeric(18,2) NULL,
          stock integer NOT NULL
        ) ON COMMIT DROP;

        CREATE INDEX ix_one_c_offer_staging_link
          ON one_c_offer_staging (source_id, external_product_id);
        """,
        ct);

      await CopyOffersToStagingAsync(db, runId, source, incomingOffers, ct);

      var unmatched = await ExecuteScalarIntAsync(
        db,
        """
        SELECT COUNT(*)::int
        FROM one_c_offer_staging s
        LEFT JOIN external_product_links l
          ON l.source_id = s.source_id
         AND l.external_product_id = s.external_product_id
         AND l.medicine_id IS NOT NULL
        WHERE l.id IS NULL;
        """,
        ct);

      var unchanged = await ExecuteScalarIntAsync(
        db,
        """
        SELECT COUNT(*)::int
        FROM one_c_offer_staging s
        JOIN external_product_links l
          ON l.source_id = s.source_id
         AND l.external_product_id = s.external_product_id
         AND l.medicine_id IS NOT NULL
        JOIN offers o
          ON o.pharmacy_id = s.pharmacy_id
         AND o.medicine_id = l.medicine_id
        WHERE o.stock_quantity = s.stock
          AND (s.price IS NULL OR o.price = s.price);
        """,
        ct);

      var updated = await db.Database.ExecuteSqlRawAsync(
        """
        UPDATE offers o
           SET stock_quantity = s.stock,
               price = COALESCE(s.price, o.price)
        FROM one_c_offer_staging s
        JOIN external_product_links l
          ON l.source_id = s.source_id
         AND l.external_product_id = s.external_product_id
         AND l.medicine_id IS NOT NULL
        WHERE o.pharmacy_id = s.pharmacy_id
          AND o.medicine_id = l.medicine_id
          AND (o.stock_quantity <> s.stock OR (s.price IS NOT NULL AND o.price <> s.price));
        """,
        ct);

      var inserted = await db.Database.ExecuteSqlRawAsync(
        """
        INSERT INTO offers (id, medicine_id, pharmacy_id, stock_quantity, price)
        SELECT s.offer_id, l.medicine_id, s.pharmacy_id, s.stock, COALESCE(s.price, 0)
        FROM one_c_offer_staging s
        JOIN external_product_links l
          ON l.source_id = s.source_id
         AND l.external_product_id = s.external_product_id
         AND l.medicine_id IS NOT NULL
        LEFT JOIN offers o
          ON o.pharmacy_id = s.pharmacy_id
         AND o.medicine_id = l.medicine_id
        WHERE o.id IS NULL
        ON CONFLICT (medicine_id, pharmacy_id) DO NOTHING;
        """,
        ct);

      await transaction.CommitAsync(ct);
      return new ImportResult(incomingOffers.Count, 0, updated, unmatched, inserted, unchanged);
    }
    catch
    {
      await transaction.RollbackAsync(ct);
      throw;
    }
    finally
    {
      if (wasClosed)
        await db.Database.CloseConnectionAsync();
    }
  }

  private static async Task CopyOffersToStagingAsync(
    AppDbContext db,
    Guid runId,
    IntegrationSource source,
    IReadOnlyList<OneCOffer> incomingOffers,
    CancellationToken ct)
  {
    if (db.Database.GetDbConnection() is not NpgsqlConnection connection)
      throw new InvalidOperationException("1C offers bulk import requires an Npgsql connection.");

    await using var writer = await connection.BeginBinaryImportAsync(
      """
      COPY one_c_offer_staging
        (offer_id, run_id, source_id, pharmacy_id, external_product_id, price, stock)
      FROM STDIN (FORMAT BINARY)
      """,
      ct);

    foreach (var offer in incomingOffers)
    {
      await writer.StartRowAsync(ct);
      await writer.WriteAsync(Guid.NewGuid(), NpgsqlDbType.Uuid, ct);
      await writer.WriteAsync(runId, NpgsqlDbType.Uuid, ct);
      await writer.WriteAsync(source.Id, NpgsqlDbType.Uuid, ct);
      await writer.WriteAsync(source.PharmacyId, NpgsqlDbType.Uuid, ct);
      await writer.WriteAsync(offer.ExternalProductId, NpgsqlDbType.Varchar, ct);
      if (offer.Price.HasValue)
        await writer.WriteAsync(offer.Price.Value, NpgsqlDbType.Numeric, ct);
      else
        await writer.WriteNullAsync(ct);
      await writer.WriteAsync(offer.Stock, NpgsqlDbType.Integer, ct);
    }

    await writer.CompleteAsync(ct);
  }

  private static async Task<int> ExecuteScalarIntAsync(AppDbContext db, string sql, CancellationToken ct)
  {
    var connection = db.Database.GetDbConnection();
    await using var command = connection.CreateCommand();
    command.CommandText = sql;
    if (db.Database.CurrentTransaction != null)
      command.Transaction = db.Database.CurrentTransaction.GetDbTransaction();

    var result = await command.ExecuteScalarAsync(ct);
    return Convert.ToInt32(result, CultureInfo.InvariantCulture);
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
    var offersByProductId = new Dictionary<string, OneCOfferAccumulator>(StringComparer.Ordinal);

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

      var stock = ParseStock(element);
      if (!offersByProductId.TryGetValue(externalProductId, out var accumulator))
      {
        accumulator = new OneCOfferAccumulator(externalProductId);
        offersByProductId.Add(externalProductId, accumulator);
      }

      accumulator.Add(rawId, TryParseDecimal(priceText, out var price) ? price : null, stock);
    }

    foreach (var offer in offersByProductId.Values)
      yield return offer.ToOffer();
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
    var quantityText = ChildValue(element, "Количество");
    if (TryParseDecimal(quantityText, out var stockFromQuantity))
      return Math.Max(0, (int)Math.Floor(stockFromQuantity));

    var warehouseStock = element
      .Descendants()
      .Where(x => string.Equals(x.Name.LocalName, "Склад", StringComparison.Ordinal)
        || string.Equals(x.Name.LocalName, "Склады", StringComparison.Ordinal))
      .Select(x => AttributeValue(x, "КоличествоНаСкладе"))
      .Where(x => !string.IsNullOrWhiteSpace(x))
      .Aggregate(0m, (sum, raw) => TryParseDecimal(raw, out var stock) ? sum + stock : sum);

    if (warehouseStock > 0m)
      return Math.Max(0, (int)Math.Floor(warehouseStock));

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
  private sealed record OneCOffer(string ExternalProductId, decimal? Price, int Stock, IReadOnlyList<string> SourceOfferIds);
  private sealed class OneCOfferAccumulator(string externalProductId)
  {
    private readonly List<string> _sourceOfferIds = [];
    private decimal? _maxPrice;
    private int _stock;

    public void Add(string sourceOfferId, decimal? price, int stock)
    {
      _sourceOfferIds.Add(sourceOfferId);
      _stock += Math.Max(0, stock);

      if (price.HasValue && (!_maxPrice.HasValue || price.Value > _maxPrice.Value))
        _maxPrice = price.Value;
    }

    public OneCOffer ToOffer() => new(externalProductId, _maxPrice, _stock, _sourceOfferIds);
  }
  private sealed record SourceContext(IntegrationSource Source, DirectoryInfo Directory);
  private sealed record ImportResult(int Processed, int Linked, int Updated, int Unmatched, int Inserted = 0, int Unchanged = 0)
  {
    public static ImportResult Empty => new(0, 0, 0, 0);
  }
}
