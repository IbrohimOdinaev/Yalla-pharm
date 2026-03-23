using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Storage;

public sealed class MinIoMedicineImageStorage : IMedicineImageStorage
{
  private readonly IMinioClient _minioClient;
  private readonly MinIoOptions _options;

  public MinIoMedicineImageStorage(IOptions<MinIoOptions> options)
  {
    _options = options.Value;

    if (string.IsNullOrWhiteSpace(_options.Endpoint))
      throw new InvalidOperationException("MinIO endpoint is not configured.");

    if (string.IsNullOrWhiteSpace(_options.BucketName))
      throw new InvalidOperationException("MinIO bucket name is not configured.");

    if (string.IsNullOrWhiteSpace(_options.AccessKey) || string.IsNullOrWhiteSpace(_options.SecretKey))
      throw new InvalidOperationException("MinIO credentials are not configured.");

    _minioClient = new MinioClient()
      .WithEndpoint(_options.Endpoint)
      .WithCredentials(_options.AccessKey, _options.SecretKey)
      .WithSSL(_options.UseSsl)
      .Build();
  }

  public async Task<string> UploadAsync(
    Stream content,
    string contentType,
    string fileName,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(content);

    if (string.IsNullOrWhiteSpace(contentType))
      throw new InvalidOperationException("Image content type is required.");

    var key = BuildImageKey(fileName);

    await EnsureBucketExistsAsync(cancellationToken);

    Stream uploadStream;
    long objectSize;
    MemoryStream? buffered = null;

    if (content.CanSeek)
    {
      content.Position = 0;
      uploadStream = content;
      objectSize = content.Length;
    }
    else
    {
      buffered = new MemoryStream();
      await content.CopyToAsync(buffered, cancellationToken);
      buffered.Position = 0;
      uploadStream = buffered;
      objectSize = buffered.Length;
    }

    try
    {
      var putArgs = new PutObjectArgs()
        .WithBucket(_options.BucketName)
        .WithObject(key)
        .WithStreamData(uploadStream)
        .WithObjectSize(objectSize)
        .WithContentType(contentType);

      await _minioClient.PutObjectAsync(putArgs, cancellationToken).ConfigureAwait(false);
    }
    catch (Exception ex)
    {
      throw CreateMinIoOperationException(
        $"Failed to upload image to MinIO bucket '{_options.BucketName}'.",
        ex);
    }
    finally
    {
      buffered?.Dispose();
    }

    return key;
  }

  public async Task<MedicineImageContent> GetContentAsync(
    string key,
    CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(key))
      throw new InvalidOperationException("Image key is required.");

    try
    {
      var stat = await _minioClient.StatObjectAsync(
        new StatObjectArgs()
          .WithBucket(_options.BucketName)
          .WithObject(key),
        cancellationToken).ConfigureAwait(false);

      var output = new MemoryStream();
      await _minioClient.GetObjectAsync(
        new GetObjectArgs()
          .WithBucket(_options.BucketName)
          .WithObject(key)
          .WithCallbackStream(stream => stream.CopyTo(output)),
        cancellationToken).ConfigureAwait(false);

      output.Position = 0;
      return new MedicineImageContent
      {
        Content = output,
        ContentType = string.IsNullOrWhiteSpace(stat.ContentType)
          ? "application/octet-stream"
          : stat.ContentType
      };
    }
    catch (Exception ex)
    {
      throw CreateMinIoOperationException(
        $"Failed to read object '{key}' from MinIO bucket '{_options.BucketName}'.",
        ex);
    }
  }

  public async Task<string> GetUrlAsync(
    string key,
    CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(key))
      return string.Empty;

    await EnsureBucketExistsAsync(cancellationToken);

    var args = new PresignedGetObjectArgs()
      .WithBucket(_options.BucketName)
      .WithObject(key)
      .WithExpiry(60 * 60);

    try
    {
      return await _minioClient.PresignedGetObjectAsync(args).ConfigureAwait(false);
    }
    catch (Exception ex)
    {
      throw CreateMinIoOperationException(
        $"Failed to create MinIO URL for object '{key}'.",
        ex);
    }
  }

  public async Task DeleteAsync(string key, CancellationToken cancellationToken = default)
  {
    if (string.IsNullOrWhiteSpace(key))
      return;

    try
    {
      var removeArgs = new RemoveObjectArgs()
        .WithBucket(_options.BucketName)
        .WithObject(key);

      await _minioClient.RemoveObjectAsync(removeArgs, cancellationToken).ConfigureAwait(false);
    }
    catch (Exception ex)
    {
      throw CreateMinIoOperationException(
        $"Failed to delete object '{key}' from MinIO bucket '{_options.BucketName}'.",
        ex);
    }
  }

  private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
  {
    try
    {
      var bucketExistsArgs = new BucketExistsArgs().WithBucket(_options.BucketName);
      var exists = await _minioClient.BucketExistsAsync(bucketExistsArgs, cancellationToken).ConfigureAwait(false);
      if (exists)
        return;

      var makeBucketArgs = new MakeBucketArgs().WithBucket(_options.BucketName);
      await _minioClient.MakeBucketAsync(makeBucketArgs, cancellationToken).ConfigureAwait(false);
    }
    catch (Exception ex)
    {
      throw CreateMinIoOperationException(
        $"Failed to connect to MinIO bucket '{_options.BucketName}'.",
        ex);
    }
  }

  private InvalidOperationException CreateMinIoOperationException(string message, Exception innerException)
  {
    return new InvalidOperationException(
      $"{message} Endpoint='{_options.Endpoint}', UseSsl={_options.UseSsl}. " +
      "Check that MinIO is running and the endpoint/credentials are correct.",
      innerException);
  }

  private static string BuildImageKey(string fileName)
  {
    var extension = Path.GetExtension(fileName);
    var normalizedExtension = string.IsNullOrWhiteSpace(extension)
      ? string.Empty
      : extension.Trim().ToLowerInvariant();

    return $"medicines/{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid():N}{normalizedExtension}";
  }
}
