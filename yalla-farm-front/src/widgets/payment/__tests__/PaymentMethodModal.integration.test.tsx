import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { buildPaymentUrlFromTemplate, PaymentMethodModal } from "@/widgets/payment/PaymentMethodModal";

describe("PaymentMethodModal", () => {
  it("replaces the Alif amount placeholder, including the legacy amaunt typo", () => {
    expect(buildPaymentUrlFromTemplate(
      "https://alifmobi.page.link/toMobi?account=+992988122731&summa={amaunt}&_imcp=1",
      171,
    )).toBe("https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1");

    expect(buildPaymentUrlFromTemplate(
      "https://alifmobi.page.link/toMobi?account=+992988122731&summa={amount}&_imcp=1",
      171,
    )).toBe("https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1");
  });

  it("renders payment methods without inline QR codes", () => {
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

    expect(screen.getByRole("img", { name: "Эсхата" })).toHaveAttribute(
      "src",
      "/payment-logos/eskhata.svg",
    );
    expect(screen.queryByTitle("Эсхата: QR для оплаты")).not.toBeInTheDocument();
    expect(screen.getAllByText("120.00 TJS")).toHaveLength(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders Alif as a direct payment action", () => {
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

    expect(screen.getByRole("img", { name: "Alif Mobi" })).toHaveAttribute(
      "src",
      "/payment-logos/alif.svg",
    );
    expect(screen.queryByTitle("Alif Mobi: QR для оплаты")).not.toBeInTheDocument();
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
