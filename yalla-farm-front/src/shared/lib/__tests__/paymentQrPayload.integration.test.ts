import { describe, expect, it } from "vitest";
import { buildPaymentQrValue } from "@/shared/lib/paymentQrPayload";

describe("buildPaymentQrValue", () => {
  it("removes Alif amount from QR deeplinks", () => {
    expect(buildPaymentQrValue("alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1"))
      .toBe("alifmobi:///toMobi?account=%2B992900000001&_imcp=1");
  });

  it("removes common query amount parameters from QR links", () => {
    expect(buildPaymentQrValue("https://pay.expresspay.tj/?A=1&s=120.00&c=abc"))
      .toBe("https://pay.expresspay.tj/?A=1&c=abc");
    expect(buildPaymentQrValue("dushanbecity://transfer?phone=992900000001&amount=120.00"))
      .toBe("dushanbecity://transfer?phone=992900000001");
  });
});
