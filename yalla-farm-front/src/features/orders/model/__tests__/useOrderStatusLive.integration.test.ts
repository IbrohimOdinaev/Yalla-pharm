import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/signalr", () => ({
  ensureSignalRConnection: vi.fn().mockResolvedValue(null)
}));

describe("useOrderStatusLive", () => {
  it("exports useOrderStatusLive function", async () => {
    const mod = await import("@/features/orders/model/useOrderStatusLive");
    expect(typeof mod.useOrderStatusLive).toBe("function");
  });
});
