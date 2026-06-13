import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentQrCard } from "@/widgets/payment/PaymentQrCard";

describe("PaymentQrCard", () => {
  it("renders react-qr-code with the full Alif deeplink metadata", () => {
    const paymentUrl = "https://alifmobi.page.link/toMobi?account=+992988122731&summa=171.00&_imcp=1";

    const { container } = render(
      <PaymentQrCard
        paymentUrl={paymentUrl}
        title="Alif Mobi"
        amount={171}
        allowed
        onOpen={() => undefined}
      />,
    );

    const qr = screen.getByTestId("payment-qr");
    expect(qr).toHaveAttribute("data-qr-value", paymentUrl);
    expect(qr.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
