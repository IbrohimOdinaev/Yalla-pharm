import { describe, expect, it } from "vitest";
import { buildPaymentQrValue } from "@/shared/lib/paymentQrPayload";

describe("buildPaymentQrValue", () => {
  it("keeps Alif amount and account metadata in QR deeplinks", () => {
    expect(buildPaymentQrValue("https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1"))
      .toBe("https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1");
  });

  it("keeps amount parameters for payment QR links", () => {
    expect(buildPaymentQrValue("https://pay.expresspay.tj/?A=1&s=120.00&c=abc"))
      .toBe("https://pay.expresspay.tj/?A=1&s=120.00&c=abc");
    expect(buildPaymentQrValue("dushanbecity://transfer?phone=992900000001&amount=120.00"))
      .toBe("dushanbecity://transfer?phone=992900000001&amount=120.00");
  });

  it("trims only outer whitespace without rewriting deeplink metadata", () => {
    expect(buildPaymentQrValue("  alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1  "))
      .toBe("alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1");
  });
});
