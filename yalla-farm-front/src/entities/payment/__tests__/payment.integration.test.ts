import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock signalr to prevent connection errors
vi.mock("@/shared/lib/signalr", () => ({
  ensureSignalRConnection: vi.fn().mockResolvedValue(null),
}));

describe("payment API", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("confirmPaymentIntent sends POST without body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { confirmPaymentIntent } = await import("@/entities/payment/api");
    await confirmPaymentIntent("token123", "intent-guid-123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain(
      "/api/superadmin/payment-intents/intent-guid-123/confirm"
    );
    expect(options.method).toBe("POST");
    // Should NOT have a JSON body
    expect(options.body).toBeUndefined();
  });

  it("rejectPaymentIntent sends POST with reason in body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { rejectPaymentIntent } = await import("@/entities/payment/api");
    await rejectPaymentIntent("token123", "intent-guid-456", "Not valid payment");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain(
      "/api/superadmin/payment-intents/intent-guid-456/reject"
    );
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.reason).toBe("Not valid payment");
  });

  it("normalizeIntent maps id to paymentIntentId", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentIntents: [
            {
              id: "real-guid",
              clientPhoneNumber: "900111222",
              amount: 500,
              state: 1,
              reservedOrderId: "order-1",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { getPendingPaymentIntents } = await import(
      "@/entities/payment/api"
    );
    const result = await getPendingPaymentIntents("token123");

    expect(result.length).toBe(1);
    expect(result[0].paymentIntentId).toBe("real-guid");
    expect(result[0].clientPhone).toBe("900111222");
  });
});
