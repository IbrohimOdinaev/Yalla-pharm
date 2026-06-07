import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PaymentRedirectPage from "@/app/payment-redirect/page";
import { renderWithProviders } from "@/test/render";

describe("PaymentRedirectPage", () => {
  it("renders a manual open button for custom payment deeplinks", async () => {
    const deepLink = "alifmobi:///toMobi?account=%2B992900000001&summa=120.00&_imcp=1";

    renderWithProviders(await PaymentRedirectPage({
      searchParams: Promise.resolve({ to: deepLink }),
    }));

    expect(screen.getByText("Нажмите кнопку ниже, чтобы открыть приложение оплаты.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть оплату" })).toHaveAttribute("href", deepLink);
  });
});
