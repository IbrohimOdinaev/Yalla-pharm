import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PaymentMethodModal } from "@/widgets/payment/PaymentMethodModal";
import { buildPaymentQrValue } from "@/shared/lib/paymentQrPayload";

describe("PaymentMethodModal", () => {
  it("renders an inline QR for payment methods", () => {
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

    const card = screen.getByText("Эсхата").closest("div");
    expect(card).not.toBeNull();
    expect(screen.getByTitle("Эсхата: QR для оплаты")).toBeInTheDocument();
    expect(screen.getAllByText("120.00 TJS").length).toBeGreaterThanOrEqual(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("encodes Alif QR through the deeplink redirect endpoint", () => {
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

    expect(screen.getByTitle("Alif Mobi: QR для оплаты")).toBeInTheDocument();
    expect(buildPaymentQrValue(url)).toContain("/api/payment/deeplink?provider=alif");
    expect(buildPaymentQrValue(url)).toContain("phone=992900000001");
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

    fireEvent.click(screen.getByRole("button", { name: /открыть оплату/i }));

    expect(onSelect).toHaveBeenCalledWith(method);
  });
});
