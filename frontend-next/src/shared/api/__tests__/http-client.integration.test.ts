import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/http-client";

describe("apiFetch integration", () => {
  it("returns parsed payload on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const result = await apiFetch<{ value: number }>("/api/test");
    expect(result.value).toBe(42);
  });

  it("formats validation errors and reason on failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify({
            title: "Request validation failed.",
            detail: "Input payload is invalid.",
            errors: {
              PhoneNumber: ["Phone number is required."],
              Password: ["Password is too short."]
            },
            reason: "validation_error"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    try {
      await apiFetch("/api/test", { method: "POST", body: {} });
      throw new Error("Expected apiFetch to throw on failed response");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Request validation failed.");
      expect(message).toContain("PhoneNumber: Phone number is required.");
      expect(message).toContain("Reason: validation_error");
    }
  });
});
