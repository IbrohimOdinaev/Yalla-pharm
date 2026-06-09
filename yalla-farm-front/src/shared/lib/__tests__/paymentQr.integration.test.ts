import { beforeEach, describe, expect, it, vi } from "vitest";
import { openPaymentQrWindow } from "@/shared/lib/paymentQr";

const toDataURLMock = vi.hoisted(() => vi.fn());

vi.mock("qrcode", () => ({
  default: {
    toDataURL: toDataURLMock,
  },
}));

beforeEach(() => {
  toDataURLMock.mockReset();
});

function mockQrWindow() {
  const writes: string[] = [];
  const targetWindow = {
    opener: {},
    document: {
      open: vi.fn(),
      write: vi.fn((html: string) => writes.push(html)),
      close: vi.fn(),
    },
  } as unknown as Window;
  vi.spyOn(window, "open").mockReturnValue(targetWindow);
  return { targetWindow, writes };
}

describe("openPaymentQrWindow", () => {
  it("opens a new tab with generated QR for a deeplink", async () => {
    toDataURLMock.mockResolvedValue("data:image/png;base64,qr");
    const { targetWindow, writes } = mockQrWindow();

    const result = await openPaymentQrWindow({
      deepLinkUrl: "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM",
      title: "Эсхата · Nishon",
      amountLabel: "Сумма: 120.00 TJS",
      walletLabel: "Кошелёк: +992900000001",
    });

    expect(result).toBe(true);
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(targetWindow.opener).toBeNull();
    expect(toDataURLMock).toHaveBeenCalledWith(
      "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM",
      expect.objectContaining({ width: 720 }),
    );
    expect(writes.at(-1)).toContain("data:image/png;base64,qr");
    expect(writes.at(-1)).toContain("eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM");
    expect(writes.at(-1)).toContain("Открыть оплату");
  });

  it("encodes Alif QR as the direct deeplink without an amount", async () => {
    toDataURLMock.mockResolvedValue("data:image/png;base64,qr");
    const { writes } = mockQrWindow();
    const deepLinkUrl = "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1";

    const result = await openPaymentQrWindow({
      deepLinkUrl,
      title: "Alif",
    });

    expect(result).toBe(true);
    expect(toDataURLMock).toHaveBeenCalledWith(
      "alifmobi:///toMobi?account=%2B992900000001&_imcp=1",
      expect.objectContaining({ width: 720 }),
    );
    expect(writes.at(-1)).toContain("alifmobi:///toMobi?account=%2B992900000001&amp;summa=120.00&amp;_imcp=1");
  });

  it("returns false when the browser blocks the new tab", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    await expect(openPaymentQrWindow({
      deepLinkUrl: "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1",
      title: "Alif",
    })).resolves.toBe(false);

    expect(toDataURLMock).not.toHaveBeenCalled();
  });
});
