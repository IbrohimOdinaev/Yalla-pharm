namespace Yalla.Application.Abstractions;

public interface IImageResizer
{
    /// <summary>
    /// Decode <paramref name="source"/>, downscale to <paramref name="targetWidth"/> (preserving
    /// aspect ratio), and re-encode as WebP. Returns null if the source can't be decoded — caller
    /// should fall back to the original bytes.
    /// </summary>
    byte[]? ResizeToWebp(ReadOnlySpan<byte> source, int targetWidth, int quality = 80);
}
