import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPaymentForCurrentDevice } from "@/shared/lib/responsivePayment";
import { openPaymentUrl } from "@/shared/lib/paymentWindow";

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
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    expect(openPaymentForCurrentDevice({
      url: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00",
      title: "Alif Mobi",
      subtitle: "Оплата через приложение Alif",
      amount: 120,
    })).toBe(true);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/payment-qr?url=alifmobi%3A%2F%2F%2FtoMobi"),
      "_blank",
      "noopener,noreferrer",
    );
    expect(openSpy.mock.calls[0][0]).toContain("title=Alif+Mobi");
    expect(openSpy.mock.calls[0][0]).toContain("amount=120");
    expect(openPaymentUrl).not.toHaveBeenCalled();
  });

  it("opens the payment link directly on mobile/tablet-class devices", () => {
    mockDesktopPaymentSurface(false);
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    vi.mocked(openPaymentUrl).mockReturnValue(true);

    expect(openPaymentForCurrentDevice({
      url: "dushanbecity://transfer?phone=992900000001&amount=120.00",
      title: "Dushanbe City",
      amount: 120,
    })).toBe(true);

    expect(openPaymentUrl).toHaveBeenCalledWith("dushanbecity://transfer?phone=992900000001&amount=120.00", undefined);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("reuses a prepared tab for desktop QR pages", () => {
    mockDesktopPaymentSurface(true);
    const paymentWindow = { closed: false, location: { href: "" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    expect(openPaymentForCurrentDevice({
      url: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00",
      title: "Alif Mobi",
      amount: 120,
      paymentWindow,
    })).toBe(true);

    expect(paymentWindow.location.href).toContain("/payment-qr?url=alifmobi%3A%2F%2F%2FtoMobi");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("passes a prepared tab to direct mobile payments", () => {
    mockDesktopPaymentSurface(false);
    const paymentWindow = { closed: false } as Window;
    vi.mocked(openPaymentUrl).mockReturnValue(true);

    expect(openPaymentForCurrentDevice({
      url: "dushanbecity://transfer?phone=992900000001&amount=120.00",
      title: "Dushanbe City",
      amount: 120,
      paymentWindow,
    })).toBe(true);

    expect(openPaymentUrl).toHaveBeenCalledWith("dushanbecity://transfer?phone=992900000001&amount=120.00", paymentWindow);
  });
});
