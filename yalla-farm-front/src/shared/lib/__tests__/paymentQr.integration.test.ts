import { describe, expect, it, vi } from "vitest";
import { openPaymentQrWindow } from "@/shared/lib/paymentQr";

describe("openPaymentQrWindow", () => {
  it("opens the shared payment QR page for a deeplink", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    const result = await openPaymentQrWindow({
      deepLinkUrl: "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM",
      title: "Эсхата · Nishon",
      amountLabel: "Сумма: 120.00 TJS",
      walletLabel: "Кошелёк: +992900000001",
    });

    expect(result).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/payment-qr?url=eskhata%3A%2F%2Fservice"),
      "_blank",
      "noopener,noreferrer",
    );
    const openedUrl = String(openSpy.mock.calls[0][0]);
    expect(openedUrl).toContain("title=%D0%AD%D1%81%D1%85%D0%B0%D1%82%D0%B0");
    expect(openedUrl).toContain("amount=120.00");
    expect(openedUrl).toContain("subtitle=");
  });

  it("keeps Alif QR routed through the shared QR page", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const deepLinkUrl = "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1";

    const result = await openPaymentQrWindow({
      deepLinkUrl,
      title: "Alif",
    });

    expect(result).toBe(true);
    const openedUrl = String(openSpy.mock.calls[0][0]);
    expect(openedUrl).toContain("/payment-qr?url=alifmobi%3A%2F%2F%2FtoMobi");
    expect(openedUrl).toContain("title=Alif");
  });

  it("returns false when the browser blocks the new tab", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    await expect(openPaymentQrWindow({
      deepLinkUrl: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1",
      title: "Alif",
    })).resolves.toBe(false);
  });
});
