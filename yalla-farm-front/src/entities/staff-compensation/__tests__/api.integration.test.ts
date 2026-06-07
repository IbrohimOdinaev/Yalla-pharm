import { beforeEach, describe, expect, it, vi } from "vitest";

describe("staff compensation API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates staff payout requests", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "request-1", amount: 45, status: "New" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { createStaffPayoutRequest } = await import("@/entities/staff-compensation/api");

    await createStaffPayoutRequest("token", {
      bank: "Alif",
      walletPhoneNumber: "+992900000111",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/staff-compensation/payout-requests"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ bank: "Alif", walletPhoneNumber: "+992900000111" }),
      }),
    );
  });

  it("loads superadmin staff payout requests", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ payoutRequests: [{ id: "request-1", amount: 45 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { getStaffPayoutRequests } = await import("@/entities/staff-compensation/api");

    const requests = await getStaffPayoutRequests("token");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.id).toBe("request-1");
  });

  it("completes staff payout requests with multipart receipt", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "request-1", status: "Completed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { completeStaffPayoutRequest } = await import("@/entities/staff-compensation/api");
    const receipt = new File(["png"], "receipt.png", { type: "image/png" });

    await completeStaffPayoutRequest("token", {
      payoutRequestId: "request-1",
      receipt,
      note: "paid",
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(String(fetchSpy.mock.calls[0]![0])).toContain("/api/staff-compensation/payout-requests/request-1/complete");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
