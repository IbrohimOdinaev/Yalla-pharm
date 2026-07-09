using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Yalla.Domain.Entities;

namespace Yalla.Tests.Shared.TestInfrastructure;

internal sealed class TestPublicIdInterceptor : SaveChangesInterceptor
{
  private static int _nextOrderPublicId = 10_000;
  private static int _nextPrescriptionPublicId = 20_000;

  public override InterceptionResult<int> SavingChanges(
    DbContextEventData eventData,
    InterceptionResult<int> result)
  {
    AssignPublicIds(eventData.Context);
    return base.SavingChanges(eventData, result);
  }

  public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
    DbContextEventData eventData,
    InterceptionResult<int> result,
    CancellationToken cancellationToken = default)
  {
    AssignPublicIds(eventData.Context);
    return base.SavingChangesAsync(eventData, result, cancellationToken);
  }

  private static void AssignPublicIds(DbContext? context)
  {
    if (context is null)
      return;

    foreach (var entry in context.ChangeTracker.Entries<Order>())
    {
      if (entry.State != EntityState.Added || entry.Entity.PublicId != 0)
        continue;

      typeof(Order)
        .GetProperty(nameof(Order.PublicId))!
        .SetValue(entry.Entity, Interlocked.Increment(ref _nextOrderPublicId));
    }

    foreach (var entry in context.ChangeTracker.Entries<Prescription>())
    {
      if (entry.State != EntityState.Added || entry.Entity.PublicId != 0)
        continue;

      typeof(Prescription)
        .GetProperty(nameof(Prescription.PublicId))!
        .SetValue(entry.Entity, Interlocked.Increment(ref _nextPrescriptionPublicId));
    }
  }
}
