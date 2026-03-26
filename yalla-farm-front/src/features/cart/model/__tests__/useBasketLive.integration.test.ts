import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/signalr", () => ({
  ensureSignalRConnection: vi.fn().mockResolvedValue(null)
}));

describe("useBasketLive", () => {
  it("exports useBasketLive function", async () => {
    const mod = await import("@/features/cart/model/useBasketLive");
    expect(typeof mod.useBasketLive).toBe("function");
  });
});
