using SkiaSharp;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Storage;

public sealed class SkiaImageResizer : IImageResizer
{
    // Mitchell-Netravali cubic gives sharp, artifact-free downscales for
    // photographic content — the default SKSamplingOptions is nearest-
    // neighbour, which produces visibly blocky thumbnails on retina screens.
    private static readonly SKSamplingOptions Sampling = new(SKCubicResampler.Mitchell);

    public byte[]? ResizeToWebp(ReadOnlySpan<byte> source, int targetWidth, int quality = 92)
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

        using var resized = bitmap.Resize(new SKImageInfo(width, height), Sampling);
        if (resized is null) return null;

        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, quality);
        return data?.ToArray();
    }
}
