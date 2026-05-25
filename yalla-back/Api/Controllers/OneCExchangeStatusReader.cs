using System.Text.Json;
using Yalla.Application.DTO.Response;

namespace Api.Controllers;

internal static class OneCExchangeStatusReader
{
  private const string StatusFileName = ".exchange-status.json";

  public static OneCExchangeStatusResponse Empty { get; } = new(null, null, null, null, null, null, null);

  public static OneCExchangeStatusResponse Read(string exchangeDirectory, string token)
  {
    var filePath = Path.Combine(exchangeDirectory, token, StatusFileName);
    if (!System.IO.File.Exists(filePath))
      return Empty;

    try
    {
      var json = System.IO.File.ReadAllText(filePath);
      var status = JsonSerializer.Deserialize<StatusFile>(json, new JsonSerializerOptions
      {
        PropertyNameCaseInsensitive = true
      });

      if (status == null)
        return Empty;

      return new OneCExchangeStatusResponse(
        status.LastContactAtUtc,
        status.LastMode,
        status.LastCheckAuthAtUtc,
        status.LastInitAtUtc,
        status.LastFileAtUtc,
        status.LastFilename,
        status.LastFileSize);
    }
    catch
    {
      return Empty;
    }
  }

  private sealed class StatusFile
  {
    public DateTime? LastContactAtUtc { get; set; }
    public string? LastMode { get; set; }
    public DateTime? LastCheckAuthAtUtc { get; set; }
    public DateTime? LastInitAtUtc { get; set; }
    public DateTime? LastFileAtUtc { get; set; }
    public string? LastFilename { get; set; }
    public long? LastFileSize { get; set; }
  }
}
