namespace Yalla.Api.IntegrationTests.TestData;

internal static class JsonTestHelpers
{
    public static async Task<Guid> ExtractIdByNameAsync(HttpResponseMessage response, string expectedName)
    {
        string payload = await response.Content.ReadAsStringAsync();
        using JsonDocument document = JsonDocument.Parse(payload);

        JsonElement element = document.RootElement
            .EnumerateArray()
            .Single(item => string.Equals(
                item.GetProperty("name").GetString(),
                expectedName,
                StringComparison.OrdinalIgnoreCase));

        return element.GetProperty("id").GetGuid();
    }

    public static async Task<bool> ListContainsNameAsync(HttpResponseMessage response, string expectedName)
    {
        string payload = await response.Content.ReadAsStringAsync();
        using JsonDocument document = JsonDocument.Parse(payload);

        return document.RootElement
            .EnumerateArray()
            .Any(item => string.Equals(
                item.GetProperty("name").GetString(),
                expectedName,
                StringComparison.OrdinalIgnoreCase));
    }
}
