using System.Security.Cryptography;
using System.Text;

namespace Yalla.BusinessLogic.Tests.TestInfrastructure;

internal static class TestIds
{
    public static Guid Id(string raw)
    {
        if (Guid.TryParse(raw, out Guid parsed))
            return parsed;

        byte[] hash = MD5.HashData(Encoding.UTF8.GetBytes(raw));

        // Format as RFC4122 variant/version to keep deterministic valid GUIDs.
        hash[6] = (byte)((hash[6] & 0x0F) | 0x50);
        hash[8] = (byte)((hash[8] & 0x3F) | 0x80);

        return new Guid(hash);
    }
}
