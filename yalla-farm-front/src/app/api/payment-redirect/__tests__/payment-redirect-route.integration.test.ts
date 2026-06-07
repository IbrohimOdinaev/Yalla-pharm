import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/payment-redirect/route";

describe("payment redirect API route", () => {
  it("returns plain HTML that redirects to the Alif deeplink and keeps a manual button fallback", async () => {
    const deepLink = "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1";

    const response = GET(new Request(`https://example.test/api/payment-redirect?to=${encodeURIComponent(deepLink)}`));
    const html = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("Открыть оплату");
    expect(html).toContain("http-equiv=\"refresh\" content=\"0;url=alifmobi:///toMobi?account=%2B992900000001&amp;summa=120.00&amp;_imcp=1\"");
    expect(html).toContain("window.location.href = target");
    expect(html).toContain("var target = \"alifmobi:///toMobi?account=%2B992900000001\\u0026summa=120.00\\u0026_imcp=1\"");
    expect(html).toContain("href=\"alifmobi:///toMobi?account=%2B992900000001&amp;summa=120.00&amp;_imcp=1\"");
    expect(html).not.toContain("_next/static");
  });
});
