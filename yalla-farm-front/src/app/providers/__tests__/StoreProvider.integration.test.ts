import { describe, expect, it } from "vitest";
import { isStaffRedirectExemptPath } from "@/app/providers/StoreProvider";

describe("StoreProvider staff redirect exemptions", () => {
  it("allows payment utility pages to stay outside staff workspaces", () => {
    expect(isStaffRedirectExemptPath("/payment-qr")).toBe(true);
    expect(isStaffRedirectExemptPath("/payment-redirect")).toBe(true);
    expect(isStaffRedirectExemptPath("/superadmin")).toBe(false);
    expect(isStaffRedirectExemptPath("/catalog")).toBe(false);
  });
});
