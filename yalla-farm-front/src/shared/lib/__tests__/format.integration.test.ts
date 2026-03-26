import { describe, expect, it } from "vitest";
import { formatMoney, formatPhone } from "@/shared/lib/format";

describe("formatMoney", () => {
  it("formats number with 2 decimals", () => {
    expect(formatMoney(100)).toBe("100.00 TJS");
  });

  it("uses custom currency", () => {
    expect(formatMoney(50, "USD")).toBe("50.00 USD");
  });

  it("handles null", () => {
    expect(formatMoney(null)).toBe("0.00 TJS");
  });

  it("handles undefined", () => {
    expect(formatMoney(undefined)).toBe("0.00 TJS");
  });

  it("handles NaN", () => {
    expect(formatMoney(NaN)).toBe("0.00 TJS");
  });
});

describe("formatPhone", () => {
  it("adds +992 prefix to 9-digit number", () => {
    expect(formatPhone("900123456")).toBe("+992900123456");
  });

  it("keeps +992 prefix if already present", () => {
    expect(formatPhone("992900123456")).toBe("+992900123456");
  });

  it("strips non-digit chars", () => {
    expect(formatPhone("+992-900-123-456")).toBe("+992900123456");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
});
