import { describe, expect, it } from "vitest";
import { normalizeLocalRedirect } from "@/shared/lib/safeRedirect";

describe("normalizeLocalRedirect", () => {
  it("keeps local absolute paths with query and hash", () => {
    expect(normalizeLocalRedirect("/checkout?order=1#pay", "/")).toBe("/checkout?order=1#pay");
  });

  it("rejects absolute external URLs", () => {
    expect(normalizeLocalRedirect("https://example.com/phish", "/")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(normalizeLocalRedirect("//example.com/phish", "/workspace")).toBe("/workspace");
  });

  it("rejects non-path values", () => {
    expect(normalizeLocalRedirect("javascript:alert(1)", "/checkout")).toBe("/checkout");
  });
});
