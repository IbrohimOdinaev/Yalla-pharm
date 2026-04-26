using SkiaSharp;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Storage;

public sealed class SkiaImageResizer : IImageResizer
{
    public byte[]? ResizeToWebp(ReadOnlySpan<byte> source, int targetWidth, int quality = 80)
    {
        if (source.IsEmpty || targetWidth <= 0)
            return null;

        using var input = new SKMemoryStream(source.ToArray());
        using var bitmap = SKBitmap.Decode(input);
        if (bitmap is null) return null;

        // Don't upscale: if the source is already smaller than the requested
        // width, just re-encode at the original resolution. Re-encoding is
        // still worth it (WebP is ~30% smaller than the JPEG/PNG most images
        // are stored as).
        var width = Math.Min(targetWidth, bitmap.Width);
        var height = (int)Math.Round(bitmap.Height * ((double)width / bitmap.Width));

        using var resized = bitmap.Resize(new SKImageInfo(width, height), SKSamplingOptions.Default);
        if (resized is null) return null;

        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, quality);
        return data?.ToArray();
    }
}
