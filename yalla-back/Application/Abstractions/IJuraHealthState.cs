namespace Yalla.Application.Abstractions;

/// <summary>
/// Singleton sink for JURA integration health signals. Written to by JuraService
/// (on every HTTP call) and by the polling hosted service (on tick outcomes).
/// Read by the /api/health/jura endpoint and by the poller itself to decide
/// whether to back off.
/// </summary>
public interface IJuraHealthState
{
  JuraHealthSnapshot GetSnapshot();

  void RecordAuthSuccess(DateTime atUtc);
  void RecordHttpSuccess(string method, string url, DateTime atUtc);
  void RecordHttpFailure(string method, string url, int? statusCode, string? reason, DateTime atUtc);

  void RecordPollSuccess(int processedOrders, DateTime atUtc);
  void RecordPollFailure(string reason, DateTime atUtc);

  /// <summary>True if the circuit breaker is currently open (poller should skip this tick).</summary>
  bool IsCircuitOpen(DateTime nowUtc);
}

public sealed class JuraHealthSnapshot
{
  public DateTime? LastAuthSuccessAtUtc { get; init; }

  public DateTime? LastHttpSuccessAtUtc { get; init; }
  public DateTime? LastHttpFailureAtUtc { get; init; }
  public string? LastHttpFailureReason { get; init; }
  public int? LastHttpFailureStatusCode { get; init; }

  public DateTime? LastPollSuccessAtUtc { get; init; }
  public DateTime? LastPollFailureAtUtc { get; init; }

  public int ConsecutiveHttpFailures { get; init; }
  public int ConsecutivePollFailures { get; init; }

  public long TotalHttpCalls { get; init; }
  public long TotalHttpFailures { get; init; }
  public long TotalPollTicks { get; init; }
  public long TotalPollFailures { get; init; }

  public bool CircuitOpen { get; init; }
  public DateTime? CircuitOpensUntilUtc { get; init; }

  public bool Healthy =>
    !CircuitOpen
    && ConsecutiveHttpFailures < 3
    && LastHttpSuccessAtUtc.HasValue;
}
