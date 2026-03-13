namespace Yalla.Infrastructure.Storage;

public sealed class MinIoOptions
{
  public const string SectionName = "MinIo";

  public string Endpoint { get; set; } = string.Empty;
  public string AccessKey { get; set; } = string.Empty;
  public string SecretKey { get; set; } = string.Empty;
  public string BucketName { get; set; } = string.Empty;
  public bool UseSsl { get; set; }
}
