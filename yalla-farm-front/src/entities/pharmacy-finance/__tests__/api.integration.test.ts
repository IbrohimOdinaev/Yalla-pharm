import { beforeEach, describe, expect, it, vi } from "vitest";

describe("pharmacy finance API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates admin withdrawal requests", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "withdrawal-1", amount: 120 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { createPharmacyWithdrawalRequest } = await import("@/entities/pharmacy-finance/api");

    await createPharmacyWithdrawalRequest("token", {
      bank: "Alif",
      walletPhoneNumber: "+992900000001",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/pharmacy-finance/admin/withdrawals"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ bank: "Alif", walletPhoneNumber: "+992900000001" }),
      }),
    );
  });

  it("completes superadmin withdrawal requests with multipart receipt", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "withdrawal-1", status: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { completePharmacyWithdrawalRequest } = await import("@/entities/pharmacy-finance/api");
    const receipt = new File(["png"], "receipt.png", { type: "image/png" });

    await completePharmacyWithdrawalRequest("token", {
      withdrawalRequestId: "withdrawal-1",
      receipt,
      comment: "paid",
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(String(fetchSpy.mock.calls[0]![0])).toContain("/api/pharmacy-finance/superadmin/withdrawals/withdrawal-1/complete");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
