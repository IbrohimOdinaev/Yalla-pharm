using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Search;

public sealed class ElasticsearchMedicineSearchEngine : IMedicineSearchEngine
{
    private readonly HttpClient _http;
    private readonly IAppDbContext _dbContext;
    private readonly ILogger<ElasticsearchMedicineSearchEngine> _logger;
    private readonly string _baseUrl;
    private readonly string _indexName;

    public ElasticsearchMedicineSearchEngine(
        string esUrl,
        IAppDbContext dbContext,
        ILogger<ElasticsearchMedicineSearchEngine> logger,
        string indexName = "medicines")
    {
        _dbContext = dbContext;
        _logger = logger;
        _baseUrl = (esUrl ?? "").TrimEnd('/');
        _indexName = indexName;

        if (!string.IsNullOrEmpty(_baseUrl))
            _http = new HttpClient { BaseAddress = new Uri(_baseUrl), Timeout = TimeSpan.FromSeconds(10) };
        else
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    }

    private bool IsDisabled => string.IsNullOrEmpty(_baseUrl);

    public async Task IndexMedicineAsync(MedicineSearchDocument doc, CancellationToken ct = default)
    {
        if (IsDisabled) return;
        await EnsureIndexAsync(ct);
        var json = JsonSerializer.Serialize(ToEsDoc(doc));
        var response = await _http.PutAsync($"/{_indexName}/_doc/{doc.Id}", new StringContent(json, Encoding.UTF8, "application/json"), ct);
        if (!response.IsSuccessStatusCode)
            _logger.LogWarning("ES index failed: {Status}", response.StatusCode);
    }

    public async Task IndexManyAsync(IEnumerable<MedicineSearchDocument> docs, CancellationToken ct = default)
    {
        if (IsDisabled) return;
        await EnsureIndexAsync(ct);
        var sb = new StringBuilder();
        foreach (var doc in docs)
        {
            sb.AppendLine(JsonSerializer.Serialize(new { index = new { _index = _indexName, _id = doc.Id.ToString() } }));
            sb.AppendLine(JsonSerializer.Serialize(ToEsDoc(doc)));
        }
        if (sb.Length == 0) return;

        var response = await _http.PostAsync("/_bulk", new StringContent(sb.ToString(), Encoding.UTF8, "application/json"), ct);
        if (!response.IsSuccessStatusCode)
            _logger.LogWarning("ES bulk index failed: {Status}", response.StatusCode);
    }

    public async Task DeleteAsync(Guid medicineId, CancellationToken ct = default)
    {
        if (IsDisabled) return;
        await _http.DeleteAsync($"/{_indexName}/_doc/{medicineId}", ct);
    }

    public async Task<IReadOnlyList<MedicineSearchResult>> SearchAsync(string query, int limit = 20, CancellationToken ct = default)
    {
        if (IsDisabled) return [];
        await EnsureIndexAsync(ct);
        var trimmed = (query ?? "").Trim();
        if (string.IsNullOrEmpty(trimmed)) return [];

        var searchBody = new
        {
            size = limit,
            query = new
            {
                @bool = new
                {
                    must = new object[]
                    {
                        new
                        {
                            @bool = new
                            {
                                should = new object[]
                                {
                                    new { multi_match = new { query = trimmed, fields = new[] { "title^3", "articul^2", "categoryName", "description" }, type = "best_fields", fuzziness = "AUTO" } },
                                    new { match_phrase_prefix = new { title = new { query = trimmed, boost = 5 } } }
                                },
                                minimum_should_match = 1
                            }
                        }
                    },
                    filter = new object[]
                    {
                        new { term = new { isActive = true } },
                        new { term = new { hasStock = true } }
                    }
                }
            }
        };

        var json = JsonSerializer.Serialize(searchBody);
        var response = await _http.PostAsync($"/{_indexName}/_search", new StringContent(json, Encoding.UTF8, "application/json"), ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("ES search failed: {Status}", response.StatusCode);
            return [];
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(body);
        var hits = doc.RootElement.GetProperty("hits").GetProperty("hits");

        var results = new List<MedicineSearchResult>();
        foreach (var hit in hits.EnumerateArray())
        {
            var source = hit.GetProperty("_source");
            var id = source.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
            if (id == null || !Guid.TryParse(id, out var guid)) continue;

            results.Add(new MedicineSearchResult
            {
                Id = guid,
                Title = source.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                Articul = source.TryGetProperty("articul", out var a) ? a.GetString() ?? "" : "",
                CategoryName = source.TryGetProperty("categoryName", out var c) ? c.GetString() : null,
                MinPrice = source.TryGetProperty("minPrice", out var p) && p.TryGetDecimal(out var price) && price > 0 ? price : null,
                Score = hit.TryGetProperty("_score", out var s) ? s.GetDouble() : 0
            });
        }

        return results;
    }

    public async Task ReindexAllAsync(CancellationToken ct = default)
    {
        if (IsDisabled) { _logger.LogInformation("Elasticsearch disabled — skipping reindex"); return; }
        // Delete index
        await _http.DeleteAsync($"/{_indexName}", ct);

        // Create index with mappings
        await EnsureIndexAsync(ct);

        // Load all medicines from DB
        var medicines = await _dbContext.Medicines
            .AsNoTracking()
            .Where(m => m.IsActive)
            .Select(m => new MedicineSearchDocument
            {
                Id = m.Id,
                Title = m.Title,
                Articul = m.Articul,
                CategoryName = m.Category != null ? m.Category.Name : null,
                Description = m.Description,
                MinPrice = m.Offers.Any(o => o.Price > 0) ? m.Offers.Where(o => o.Price > 0).Min(o => o.Price) : 0m,
                IsActive = m.IsActive,
                HasStock = m.Offers.Any(o => o.StockQuantity > 0)
            })
            .ToListAsync(ct);

        _logger.LogInformation("Reindexing {Count} medicines to Elasticsearch", medicines.Count);
        await IndexManyAsync(medicines, ct);
    }

    private bool _indexEnsured;

    private async Task EnsureIndexAsync(CancellationToken ct)
    {
        if (_indexEnsured) return;

        var response = await _http.GetAsync($"/{_indexName}", ct);
        if (!response.IsSuccessStatusCode)
        {
            var indexSettings = new
            {
                settings = new
                {
                    analysis = new
                    {
                        analyzer = new
                        {
                            russian_custom = new
                            {
                                type = "custom",
                                tokenizer = "standard",
                                filter = new[] { "lowercase", "russian_stemmer" }
                            }
                        },
                        filter = new
                        {
                            russian_stemmer = new { type = "stemmer", language = "russian" }
                        }
                    }
                },
                mappings = new
                {
                    properties = new Dictionary<string, object>
                    {
                        ["id"] = new { type = "keyword" },
                        ["title"] = new { type = "text", analyzer = "russian_custom", fields = new { raw = new { type = "keyword" } } },
                        ["articul"] = new { type = "text", analyzer = "standard" },
                        ["categoryName"] = new { type = "text", analyzer = "russian_custom" },
                        ["description"] = new { type = "text", analyzer = "russian_custom" },
                        ["minPrice"] = new { type = "float" },
                        ["isActive"] = new { type = "boolean" },
                        ["hasStock"] = new { type = "boolean" }
                    }
                }
            };

            var json = JsonSerializer.Serialize(indexSettings);
            var createResponse = await _http.PutAsync($"/{_indexName}", new StringContent(json, Encoding.UTF8, "application/json"), ct);
            if (!createResponse.IsSuccessStatusCode)
                _logger.LogWarning("Failed to create ES index: {Status}", createResponse.StatusCode);
        }

        _indexEnsured = true;
    }

    private static object ToEsDoc(MedicineSearchDocument doc) => new
    {
        id = doc.Id.ToString(),
        title = doc.Title,
        articul = doc.Articul,
        categoryName = doc.CategoryName ?? "",
        description = doc.Description ?? "",
        minPrice = doc.MinPrice.HasValue ? (float)doc.MinPrice.Value : 0f,
        isActive = doc.IsActive,
        hasStock = doc.HasStock
    };
}
