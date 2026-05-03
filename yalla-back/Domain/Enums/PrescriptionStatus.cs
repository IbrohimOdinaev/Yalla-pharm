namespace Yalla.Domain.Enums;

/// <summary>
/// Prescription life-cycle states.
///
/// Submitted              — client uploaded photos + age + comment, awaiting payment.
/// AwaitingConfirmation   — 3 TJS payment received, awaiting SuperAdmin confirm.
/// InQueue                — confirmed, waiting for any pharmacist to pick it up.
/// InReview               — a pharmacist took it and is composing the checklist.
/// Decoded                — pharmacist sent the checklist back to the client.
/// OrderPlaced            — client converted the checklist into an actual order.
/// MovedToCart            — client pushed in-catalog positions into the regular basket.
/// Cancelled              — client cancelled (pre-decode) or pharmacist rejected
///                          ("can't read"). Non-refundable for now.
/// </summary>
public enum PrescriptionStatus
{
    Submitted,
    AwaitingConfirmation,
    InQueue,
    InReview,
    Decoded,
    OrderPlaced,
    MovedToCart,
    Cancelled
}
