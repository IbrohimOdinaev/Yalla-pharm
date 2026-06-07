import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/payment/deeplink/route";

describe("payment deeplink API route", () => {
  it("builds an Alif deeplink from provider, phone and amount and redirects immediately", async () => {
    const response = GET(new Request("https://example.test/api/payment/deeplink?provider=alif&phone=%2B992900000001&amount=120"));
    const html = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(html).toContain("http-equiv=\"refresh\" content=\"0;url=alifmobi:///toMobi?account=%2B992900000001&amp;summa=120.00&amp;_imcp=1\"");
    expect(html).toContain("var target = \"alifmobi:///toMobi?account=%2B992900000001\\u0026summa=120.00\\u0026_imcp=1\"");
    expect(html).toContain("href=\"alifmobi:///toMobi?account=%2B992900000001&amp;summa=120.00&amp;_imcp=1\"");
    expect(html).not.toContain("_next/static");
  });

  it("does not build a deeplink when required payment data is missing", async () => {
    const response = GET(new Request("https://example.test/api/payment/deeplink?provider=alif&phone=%2B992900000001"));
    const html = await response.text();

    expect(html).toContain("Недостаточно данных для оплаты.");
    expect(html).not.toContain("alifmobi:///toMobi");
    expect(html).not.toContain("window.location.href = target");
  });
});
