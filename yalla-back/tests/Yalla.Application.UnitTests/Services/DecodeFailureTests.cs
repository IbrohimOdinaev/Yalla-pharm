using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Services;

public sealed class DecodeFailureTests
{
  private static Prescription BuildInReview(Guid pharmacistId, Guid? clientId = null)
  {
    var p = new Prescription(
      clientId ?? Guid.NewGuid(),
      patientAge: 30,
      clientComment: null,
      images: new[] { new PrescriptionImage("k", 0) },
      preferenceTier: PrescriptionPreferenceTier.AsPrescribed);
    p.MoveToAwaitingConfirmation();
    p.MoveToQueue();
    p.TakeIntoReview(pharmacistId);
    return p;
  }

  // ── Domain ─────────────────────────────────────────────────────

  [Fact]
  public void MarkDecodeFailed_records_metadata_and_flips_status()
  {
    var pharmacist = Guid.NewGuid();
    var p = BuildInReview(pharmacist);

    p.MarkDecodeFailed(pharmacist, PrescriptionDecodeFailureReason.PoorImageQuality, "blurry");

    Assert.Equal(PrescriptionStatus.DecodeFailed, p.Status);
    Assert.Equal(PrescriptionDecodeFailureReason.PoorImageQuality, p.DecodeFailureReason);
    Assert.Equal(pharmacist, p.DecodeFailedByPharmacistId);
    Assert.NotNull(p.DecodeFailedAtUtc);
    Assert.Equal("blurry", p.DecodeFailureComment);
  }

  [Fact]
  public void MarkDecodeFailed_rejects_unassigned_pharmacist()
  {
    var assigned = Guid.NewGuid();
    var other = Guid.NewGuid();
    var p = BuildInReview(assigned);

    Assert.Throws<DomainException>(() =>
      p.MarkDecodeFailed(other, PrescriptionDecodeFailureReason.IllegibleHandwriting, null));
  }

  [Fact]
  public void MarkDecodeFailed_rejects_wrong_status()
  {
    var pharmacist = Guid.NewGuid();
    var p = new Prescription(
      Guid.NewGuid(), 30, null,
      new[] { new PrescriptionImage("k", 0) },
      PrescriptionPreferenceTier.AsPrescribed);
    // Still Submitted — not yet InReview.

    Assert.Throws<DomainException>(() =>
      p.MarkDecodeFailed(pharmacist, PrescriptionDecodeFailureReason.PoorImageQuality, null));
  }

  [Fact]
  public void MarkDecodeFailed_clamps_overlong_comment()
  {
    var pharmacist = Guid.NewGuid();
    var p = BuildInReview(pharmacist);
    var huge = new string('A', 3000);

    p.MarkDecodeFailed(pharmacist, PrescriptionDecodeFailureReason.PoorImageQuality, huge);

    Assert.Equal(2000, p.DecodeFailureComment!.Length); // MaxPharmacistCommentLength
  }

  // ── Client free credit ─────────────────────────────────────────

  [Fact]
  public void Grant_then_Consume_credit_round_trip()
  {
    var client = new Client("C", "111111125", "hash");
    Assert.False(client.HasFreePrescriptionCredit);

    client.GrantFreePrescriptionCredit();
    Assert.True(client.HasFreePrescriptionCredit);

    client.ConsumeFreePrescriptionCredit();
    Assert.False(client.HasFreePrescriptionCredit);
  }

  [Fact]
  public void Grant_credit_is_idempotent()
  {
    var client = new Client("C", "111111126", "hash");
    client.GrantFreePrescriptionCredit();
    client.GrantFreePrescriptionCredit();  // second call — still single flag
    Assert.True(client.HasFreePrescriptionCredit);

    client.ConsumeFreePrescriptionCredit();
    Assert.False(client.HasFreePrescriptionCredit);
    // Second consume should throw — there's no stacked credit.
    Assert.Throws<DomainException>(() => client.ConsumeFreePrescriptionCredit());
  }

  // ── PendingRefund ─────────────────────────────────────────────

  [Fact]
  public void PendingRefund_constructed_with_required_fields()
  {
    var r = new PendingRefund(
      clientId: Guid.NewGuid(),
      prescriptionId: Guid.NewGuid(),
      amount: 3m,
      currency: "tjs",
      reason: "Illegible.");

    Assert.Equal("TJS", r.Currency);  // upper-cased
    Assert.Equal(3m, r.Amount);
    Assert.Null(r.ProcessedAtUtc);
    Assert.Null(r.ProcessedByUserId);
  }

  [Fact]
  public void PendingRefund_MarkProcessed_sets_metadata()
  {
    var r = new PendingRefund(Guid.NewGuid(), Guid.NewGuid(), 3m, "TJS", "reason");
    var admin = Guid.NewGuid();

    r.MarkProcessed(admin, "Bank ref 12345");

    Assert.NotNull(r.ProcessedAtUtc);
    Assert.Equal(admin, r.ProcessedByUserId);
    Assert.Equal("Bank ref 12345", r.SuperAdminComment);
  }

  [Fact]
  public void PendingRefund_double_processing_throws()
  {
    var r = new PendingRefund(Guid.NewGuid(), Guid.NewGuid(), 3m, "TJS", "reason");
    r.MarkProcessed(Guid.NewGuid(), null);

    Assert.Throws<DomainException>(() => r.MarkProcessed(Guid.NewGuid(), "second try"));
  }

  [Fact]
  public void PendingRefund_negative_amount_rejected()
  {
    Assert.Throws<DomainArgumentException>(() =>
      new PendingRefund(Guid.NewGuid(), Guid.NewGuid(), -1m, "TJS", "x"));
  }
}
