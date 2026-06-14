import { describe, expect, it } from "vitest";
import { buildPaymentQrValue } from "@/shared/lib/paymentQrPayload";

describe("buildPaymentQrValue", () => {
  it("keeps Alif amount and account metadata in QR deeplinks", () => {
    expect(buildPaymentQrValue("https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1"))
      .toBe("https://alifmobi.page.link/toMobi?account=%2B992988122731&summa=171.00&_imcp=1");
  });

  it("keeps amount parameters for payment QR links", () => {
    expect(buildPaymentQrValue("https://pay.expresspay.tj/?A=1&s=120.00&c=abc"))
      .toBe("https://pay.expresspay.tj/?A=1&s=120.00&c=abc");
    expect(buildPaymentQrValue("dushanbecity://transfer?phone=992900000001&amount=120.00"))
      .toBe("dushanbecity://transfer?phone=992900000001&amount=120.00");
  });

  it("uses the Alif dynamic link format when QR receives the old app deeplink", () => {
    expect(buildPaymentQrValue("  alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1  "))
      .toBe("https://alifmobi.page.link/toMobi?account=%2B992900000001&summa=120.00&_imcp=1");
  });
});
