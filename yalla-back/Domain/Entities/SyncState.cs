using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class SyncState
{
    public string Key { get; private set; } = string.Empty;

    public string Value { get; private set; } = string.Empty;

    public DateTime UpdatedAtUtc { get; private set; }

    private SyncState() { }

    public SyncState(string key, string value, DateTime updatedAtUtc)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new DomainArgumentException("SyncState.Key can't be null or whitespace.");

        Key = key;
        Value = value ?? string.Empty;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void SetValue(string value, DateTime updatedAtUtc)
    {
        Value = value ?? string.Empty;
        UpdatedAtUtc = updatedAtUtc;
    }
}
