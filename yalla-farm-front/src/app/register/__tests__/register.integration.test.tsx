import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RegisterPage from "@/app/register/page";
import { renderWithProviders } from "@/test/render";

// /register is now a thin redirect page: there's no separate registration
// form anymore — sign-up happens implicitly via the SMS-OTP flow on
// /login. The page surfaces a short explainer and a link back to /login.
describe("RegisterPage", () => {
  it("shows the «Регистрация теперь по SMS» explainer", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByText("Регистрация теперь по SMS")).toBeInTheDocument();
  });

  it("links to /login via the «Перейти ко входу» button", () => {
    renderWithProviders(<RegisterPage />);
    const loginLink = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/login");
    expect(loginLink).toBeDefined();
  });
});
