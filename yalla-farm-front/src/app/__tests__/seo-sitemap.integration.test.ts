import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
});

describe("sitemap", () => {
  it("includes static, category, and product SEO routes", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pharm.yalla.tj";
    process.env.INTERNAL_API_URL = "https://api.yalla.test";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/categories")) {
          return new Response(
            JSON.stringify({
              categories: [
                {
                  id: "cat-1",
                  name: "Боль и жар",
                  slug: "bol-i-zhar",
                  isActive: true,
                  wooCommerceId: 1,
                  children: [],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/api/medicines")) {
          return new Response(
            JSON.stringify({
              page: 1,
              pageSize: 100,
              totalCount: 2,
              medicines: [
                { id: "medicine-1", slug: "analgin", title: "Анальгин", isActive: true },
                { id: "medicine-2", title: "Без slug", isActive: true },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(null, { status: 404 });
      }),
    );

    const urls = (await sitemap()).map((route) => route.url);

    expect(urls).toContain("https://pharm.yalla.tj/");
    expect(urls).toContain("https://pharm.yalla.tj/catalog/bol-i-zhar");
    expect(urls).toContain("https://pharm.yalla.tj/product/analgin");
    expect(urls).toContain("https://pharm.yalla.tj/product/medicine-2");
  });

  it("falls back to static routes when API is unavailable", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pharm.yalla.tj";
    process.env.INTERNAL_API_URL = "https://api.yalla.test";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const routes = await sitemap();
    const urls = routes.map((route) => route.url);

    expect(urls).toContain("https://pharm.yalla.tj/");
    expect(urls).toContain("https://pharm.yalla.tj/catalog");
    expect(urls).toContain("https://pharm.yalla.tj/pharmacies");
  });
});
