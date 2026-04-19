using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Jura;

public sealed class JuraHealthState : IJuraHealthState
{
  // Circuit breaker thresholds: after 5 consecutive HTTP failures, hold off
  // the poller for 2 minutes. Success resets the counters.
  private const int CircuitOpenThreshold = 5;
  private static readonly TimeSpan CircuitOpenDuration = TimeSpan.FromMinutes(2);

  private readonly object _lock = new();

  private DateTime? _lastAuthSuccess;
  private DateTime? _lastHttpSuccess;
  private DateTime? _lastHttpFailure;
  private string? _lastHttpFailureReason;
  private int? _lastHttpFailureStatus;
  private DateTime? _lastPollSuccess;
  private DateTime? _lastPollFailure;
  private int _consecutiveHttpFailures;
  private int _consecutivePollFailures;
  private long _totalHttpCalls;
  private long _totalHttpFailures;
  private long _totalPollTicks;
  private long _totalPollFailures;
  private DateTime? _circuitOpenUntil;

  public JuraHealthSnapshot GetSnapshot()
  {
    lock (_lock)
    {
      var now = DateTime.UtcNow;
      var open = _circuitOpenUntil.HasValue && _circuitOpenUntil.Value > now;
      return new JuraHealthSnapshot
      {
        LastAuthSuccessAtUtc = _lastAuthSuccess,
        LastHttpSuccessAtUtc = _lastHttpSuccess,
        LastHttpFailureAtUtc = _lastHttpFailure,
        LastHttpFailureReason = _lastHttpFailureReason,
        LastHttpFailureStatusCode = _lastHttpFailureStatus,
        LastPollSuccessAtUtc = _lastPollSuccess,
        LastPollFailureAtUtc = _lastPollFailure,
        ConsecutiveHttpFailures = _consecutiveHttpFailures,
        ConsecutivePollFailures = _consecutivePollFailures,
        TotalHttpCalls = _totalHttpCalls,
        TotalHttpFailures = _totalHttpFailures,
        TotalPollTicks = _totalPollTicks,
        TotalPollFailures = _totalPollFailures,
        CircuitOpen = open,
        CircuitOpensUntilUtc = open ? _circuitOpenUntil : null
      };
    }
  }

  public void RecordAuthSuccess(DateTime atUtc)
  {
    lock (_lock)
    {
      _lastAuthSuccess = atUtc;
    }
  }

  public void RecordHttpSuccess(string method, string url, DateTime atUtc)
  {
    lock (_lock)
    {
      _totalHttpCalls++;
      _lastHttpSuccess = atUtc;
      _consecutiveHttpFailures = 0;
      _circuitOpenUntil = null;
    }
  }

  public void RecordHttpFailure(string method, string url, int? statusCode, string? reason, DateTime atUtc)
  {
    lock (_lock)
    {
      _totalHttpCalls++;
      _totalHttpFailures++;
      _lastHttpFailure = atUtc;
      _lastHttpFailureReason = reason;
      _lastHttpFailureStatus = statusCode;
      _consecutiveHttpFailures++;

      if (_consecutiveHttpFailures >= CircuitOpenThreshold)
      {
        _circuitOpenUntil = atUtc + CircuitOpenDuration;
      }
    }
  }

  public void RecordPollSuccess(int processedOrders, DateTime atUtc)
  {
    lock (_lock)
    {
      _totalPollTicks++;
      _lastPollSuccess = atUtc;
      _consecutivePollFailures = 0;
    }
  }

  public void RecordPollFailure(string reason, DateTime atUtc)
  {
    lock (_lock)
    {
      _totalPollTicks++;
      _totalPollFailures++;
      _lastPollFailure = atUtc;
      _consecutivePollFailures++;
    }
  }

  public bool IsCircuitOpen(DateTime nowUtc)
  {
    lock (_lock)
    {
      return _circuitOpenUntil.HasValue && _circuitOpenUntil.Value > nowUtc;
    }
  }
}
