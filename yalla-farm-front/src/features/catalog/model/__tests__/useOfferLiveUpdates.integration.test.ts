import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/signalr", () => ({
  ensureSignalRConnection: vi.fn().mockResolvedValue(null)
}));

describe("useOfferLiveUpdates", () => {
  it("exports useOfferLiveUpdates function", async () => {
    const mod = await import("@/features/catalog/model/useOfferLiveUpdates");
    expect(typeof mod.useOfferLiveUpdates).toBe("function");
  });
});
