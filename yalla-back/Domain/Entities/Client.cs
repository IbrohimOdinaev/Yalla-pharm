using Yalla.Domain.Exceptions;
using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

public class Client : User
{
    private readonly List<BasketPosition> _basketPositions = new();

    private readonly List<Order> _orders = new();

    public IReadOnlyCollection<Order> Orders => _orders.AsReadOnly();

    public IReadOnlyCollection<BasketPosition> BasketPositions => _basketPositions.AsReadOnly();

    /// <summary>Version string of the privacy policy this client most
    /// recently accepted (e.g. "1.0-2026-05-12"). Null when no version
    /// has ever been accepted — that's the gate flag for any flow that
    /// processes special-category data (prescription photos in our
    /// case). Compared against
    /// <c>Compliance:PrivacyPolicyCurrentVersion</c> from config; a
    /// mismatch forces the client to re-accept before continuing.</summary>
    public string? PrivacyPolicyVersionAccepted { get; private set; }

    public DateTime? PrivacyPolicyAcceptedAtUtc { get; private set; }

    /// <summary>Source IP captured at acceptance time — required by Закон
    /// РТ № 1537 audit trail expectations. Truncated to 64 chars; null
    /// when the call originated outside an HTTP context (background
    /// job, etc.).</summary>
    public string? PrivacyPolicyAcceptedFromIp { get; private set; }

    /// <summary>One-shot credit toward a free prescription decoding.
    /// Granted when a pharmacist rejected a prior submission for
    /// "poor image quality" (the client wasn't at fault for the
    /// pharmacist's specific image-quality complaint, but the
    /// pharmacist's time was already paid for). Consumed at the next
    /// prescription submission, skipping the 3 TJS payment intent.</summary>
    public bool HasFreePrescriptionCredit { get; private set; }


    private Client() : base() { }

    public Client(string name, string phoneNumber, string passwordHash)
      : base(Guid.NewGuid(), name, phoneNumber, passwordHash, Role.Client)
    {
    }

    public Client(string name, long telegramId, string? telegramUsername = null)
      : base(Guid.NewGuid(), name, telegramId, telegramUsername, Role.Client)
    {
    }

    public Client(string name, string phoneNumber)
      : base(Guid.NewGuid(), name, phoneNumber, Role.Client)
    {
    }

    public Client(
      Guid id,
      string name,
      string phoneNumber,
      string passwordHash,
      Role role,
      List<Order> orders)
      : base(id, name, phoneNumber, passwordHash, role)
    {
        if (orders is null)
            throw new DomainArgumentException("Orders can't be null.");

        _orders.AddRange(orders);
    }


    public void AddOrder(Order? order)
    {
        if (order is null)
            throw new DomainArgumentException("Order can't be null.");

        _orders.Add(order);
    }

    public void RemoveOrder(Order? order)
    {
        if (order is null)
            throw new DomainArgumentException("Order can't be null.");

        _orders.Remove(order);
    }

    public void AddBasketPosition(BasketPosition? basketPosition)
    {
        if (basketPosition is null)
            throw new DomainArgumentException("BasketPosition can't be null.");

        _basketPositions.Add(basketPosition);
    }

    public void RemoveBasketPosition(BasketPosition? basketPosition)
    {
        if (basketPosition is null)
            throw new DomainArgumentException("BasketPosition can't be null.");

        _basketPositions.Remove(basketPosition);
    }

    /// <summary>
    /// Grant a one-shot credit for free prescription decoding —
    /// called from <c>PrescriptionService.MarkDecodeFailedAsync</c>
    /// when the pharmacist's stated reason was poor image quality.
    /// Idempotent: re-granting on an already-credited client is a
    /// silent no-op so concurrent failures don't accidentally stack
    /// multiple credits.
    /// </summary>
    public void GrantFreePrescriptionCredit() => HasFreePrescriptionCredit = true;

    /// <summary>
    /// Consume the credit at the next submission. Throws when no
    /// credit exists — the caller is expected to have checked
    /// <see cref="HasFreePrescriptionCredit"/> first; this is a
    /// safety net so we never silently "use" a credit that wasn't
    /// there.
    /// </summary>
    public void ConsumeFreePrescriptionCredit()
    {
        if (!HasFreePrescriptionCredit)
            throw new DomainException("Client has no free prescription credit to consume.");
        HasFreePrescriptionCredit = false;
    }

    /// <summary>
    /// Record the client's acceptance of a privacy-policy version. The
    /// service layer is expected to have already validated that
    /// <paramref name="version"/> matches the current configured
    /// version — this method itself only enforces argument shape so the
    /// row that lands in the audit history is always well-formed.
    /// </summary>
    /// <param name="version">Policy version string, e.g.
    /// "1.0-2026-05-12". Required.</param>
    /// <param name="acceptedAtUtc">UTC timestamp of acceptance.</param>
    /// <param name="acceptedFromIp">Source IP (optional, may be null
    /// when no HTTP context, e.g. admin-driven backfill).</param>
    public void AcceptPrivacyPolicy(string version, DateTime acceptedAtUtc, string? acceptedFromIp)
    {
        if (string.IsNullOrWhiteSpace(version))
            throw new DomainArgumentException("Privacy policy version can't be null or whitespace.");
        if (version.Length > 64)
            throw new DomainArgumentException("Privacy policy version length can't exceed 64 chars.");

        PrivacyPolicyVersionAccepted = version.Trim();
        PrivacyPolicyAcceptedAtUtc = acceptedAtUtc.Kind == DateTimeKind.Utc
            ? acceptedAtUtc
            : DateTime.SpecifyKind(acceptedAtUtc, DateTimeKind.Utc);
        PrivacyPolicyAcceptedFromIp = string.IsNullOrWhiteSpace(acceptedFromIp)
            ? null
            : acceptedFromIp.Trim().Length > 64
                ? acceptedFromIp.Trim()[..64]
                : acceptedFromIp.Trim();
    }
}
