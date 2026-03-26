import { describe, expect, it, vi } from "vitest";

// Mock signalr module
vi.mock("@/shared/lib/signalr", () => ({
  ensureSignalRConnection: vi.fn().mockResolvedValue(null)
}));

describe("useSignalR module", () => {
  it("exports useSignalREvent function", async () => {
    const mod = await import("@/shared/lib/useSignalR");
    expect(typeof mod.useSignalREvent).toBe("function");
  });
});
