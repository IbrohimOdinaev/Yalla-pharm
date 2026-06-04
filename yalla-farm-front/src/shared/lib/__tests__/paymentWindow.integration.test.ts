import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedPaymentUrl, openPaymentUrl } from "@/shared/lib/paymentWindow";

describe("paymentWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows http, https, and Eskhata deep links", () => {
    expect(isAllowedPaymentUrl("https://alifmobi.page.link/toMobi?summa=10")).toBe(true);
    expect(isAllowedPaymentUrl("http://pay.example.test/order/1")).toBe(true);
    expect(isAllowedPaymentUrl("dushanbecity://transfer?phone=992900000001&amount=10.00")).toBe(true);
    expect(isAllowedPaymentUrl("alifmobi://transfer?phone=992900000001&amount=10.00")).toBe(true);
    expect(isAllowedPaymentUrl("eskhata://service/id/account/10/code")).toBe(true);
  });

  it("rejects script and data URLs", () => {
    expect(isAllowedPaymentUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedPaymentUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("closes a prepared window instead of navigating to an unsafe URL", () => {
    const paymentWindow = {
      closed: false,
      close: vi.fn(),
      location: { href: "about:blank" },
    } as unknown as Window;

    expect(openPaymentUrl("javascript:alert(1)", paymentWindow)).toBe(false);
    expect(paymentWindow.close).toHaveBeenCalledTimes(1);
    expect(paymentWindow.location.href).toBe("about:blank");
  });

  it("opens safe URLs in a new window when no prepared window exists", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);

    expect(openPaymentUrl("https://pay.example.test/order/1")).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://pay.example.test/order/1",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
