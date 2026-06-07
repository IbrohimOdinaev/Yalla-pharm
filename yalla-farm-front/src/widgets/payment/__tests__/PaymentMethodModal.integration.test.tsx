import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PaymentMethodModal } from "@/widgets/payment/PaymentMethodModal";
import { openPaymentQrWindow } from "@/shared/lib/paymentQr";

vi.mock("@/shared/lib/paymentQr", () => ({
  openPaymentQrWindow: vi.fn().mockResolvedValue(true),
}));

describe("PaymentMethodModal", () => {
  it("opens a generated QR window for QR-supported payment methods", () => {
    const onSelect = vi.fn();

    const method = {
      id: "eskhata" as const,
      title: "Эсхата",
      subtitle: "Кошелек Эсхата",
      url: "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM",
    };

    renderWithProviders(
      <PaymentMethodModal
        open
        amount={120}
        methods={[method]}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /qr/i }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(openPaymentQrWindow).toHaveBeenCalledWith({
      deepLinkUrl: method.url,
      title: "Эсхата: QR для оплаты",
      amountLabel: "К оплате: 120.00 TJS",
      walletLabel: "Кошелек Эсхата",
    });
  });

  it("opens generated QR action for Alif deeplinks", () => {
    const url = "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1";

    renderWithProviders(
      <PaymentMethodModal
        open
        amount={120}
        methods={[
          {
            id: "alif",
            title: "Alif Mobi",
            subtitle: "Кошелек Alif",
            url,
          },
        ]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /qr/i }));

    expect(openPaymentQrWindow).toHaveBeenCalledWith({
      deepLinkUrl: url,
      title: "Alif Mobi: QR для оплаты",
      amountLabel: "К оплате: 120.00 TJS",
      walletLabel: "Кошелек Alif",
    });
  });

  it("keeps the direct open action for payment methods", () => {
    const onSelect = vi.fn();
    const method = {
      id: "eskhata" as const,
      title: "Эсхата",
      subtitle: "Кошелек Эсхата",
      url: "eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/992900000001/120.00/DA00126FM",
    };

    renderWithProviders(
      <PaymentMethodModal
        open
        amount={120}
        methods={[method]}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /открыть/i }));

    expect(onSelect).toHaveBeenCalledWith(method);
  });
});
