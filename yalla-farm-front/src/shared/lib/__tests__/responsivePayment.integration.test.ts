import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPaymentForCurrentDevice } from "@/shared/lib/responsivePayment";
import { openPaymentQrWindow } from "@/shared/lib/paymentQr";
import { openPaymentUrl } from "@/shared/lib/paymentWindow";

vi.mock("@/shared/lib/paymentQr", () => ({
  openPaymentQrWindow: vi.fn(),
}));

vi.mock("@/shared/lib/paymentWindow", () => ({
  openPaymentUrl: vi.fn(),
}));

function mockDesktopPaymentSurface(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("openPaymentForCurrentDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a QR page on desktop-class devices", () => {
    mockDesktopPaymentSurface(true);

    expect(openPaymentForCurrentDevice({
      url: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00",
      title: "Alif Mobi",
      subtitle: "Оплата через приложение Alif",
      amount: 120,
    })).toBe(true);

    expect(openPaymentQrWindow).toHaveBeenCalledWith({
      deepLinkUrl: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00",
      title: "Alif Mobi",
      amountLabel: "Сумма: 120.00 TJS",
      walletLabel: "Оплата через приложение Alif",
    });
    expect(openPaymentUrl).not.toHaveBeenCalled();
  });

  it("opens the payment link directly on mobile/tablet-class devices", () => {
    mockDesktopPaymentSurface(false);
    vi.mocked(openPaymentUrl).mockReturnValue(true);

    expect(openPaymentForCurrentDevice({
      url: "dushanbecity://transfer?phone=992900000001&amount=120.00",
      title: "Dushanbe City",
      amount: 120,
    })).toBe(true);

    expect(openPaymentUrl).toHaveBeenCalledWith("dushanbecity://transfer?phone=992900000001&amount=120.00");
    expect(openPaymentQrWindow).not.toHaveBeenCalled();
  });
});
