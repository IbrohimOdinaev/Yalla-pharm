import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";

describe("next rewrites", () => {
  it("does not proxy local Mahal API routes to the backend", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(Array.isArray(rewrites)).toBe(true);

    const apiRewrite = Array.isArray(rewrites) ? rewrites[0] : null;
    expect(apiRewrite?.source).toContain("map/mahal");

    const source = apiRewrite?.source ?? "";
    const group = source.match(/:path\((.*)\)/)?.[1];
    expect(group).toBeTruthy();
    const pattern = new RegExp(`^/api/${group}$`);

    expect(pattern.test("/api/map/mahal/search")).toBe(false);
    expect(pattern.test("/api/1c/exchange")).toBe(false);
    expect(pattern.test("/api/medicines")).toBe(true);
  });
});

describe("next security headers", () => {
  it("sets baseline browser hardening headers", async () => {
    const headerRules = await nextConfig.headers?.();
    const headers = new Map(headerRules?.[0]?.headers.map((x) => [x.key, x.value]));

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
