import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "@/app/login/page";
import { renderWithProviders } from "@/test/render";

// The public /login is now an SMS-OTP flow (phone → SMS code → optional
// name on first sign-in). The old password+role login is at /login/admin.
// These tests verify the OTP page's initial chrome only — the OTP request
// and code-verify mutations are covered separately by API integration tests
// since they require a multi-step network mock and timer machinery.
describe("LoginPage (OTP)", () => {
  it("renders phone input + Получить код + Telegram buttons", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByPlaceholderText("93 •••• •• ••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Получить код/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Войти через Telegram/ })).toBeInTheDocument();
  });

  it("renders the «+992» country prefix", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText("+992")).toBeInTheDocument();
  });

  it("links to /login/admin for staff sign-in", () => {
    renderWithProviders(<LoginPage />);
    const adminLink = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/login/admin");
    expect(adminLink).toBeDefined();
  });
});
