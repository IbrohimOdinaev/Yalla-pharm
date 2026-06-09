import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import * as authApi from "@/entities/auth/api";
import { connectTelegramAuthHub } from "@/shared/lib/telegramAuthHub";
import { renderWithProviders } from "@/test/render";

vi.mock("@/entities/auth/api", () => ({
  requestClientOtp: vi.fn(),
  verifyClientOtp: vi.fn(),
  resendClientOtp: vi.fn(),
  startTelegramAuth: vi.fn(),
  completeTelegramAuth: vi.fn(),
  pollTelegramAuth: vi.fn(),
}));

vi.mock("@/shared/lib/telegramAuthHub", () => ({
  connectTelegramAuthHub: vi.fn(),
}));

// The public /login is now an SMS-OTP flow (phone → SMS code → optional
// name on first sign-in). The old password+role login is at /login/admin.
// These tests verify the OTP page's initial chrome only — the OTP request
// and code-verify mutations are covered separately by API integration tests
// since they require a multi-step network mock and timer machinery.
describe("LoginPage (OTP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(connectTelegramAuthHub).mockResolvedValue({
      stop: vi.fn(() => Promise.resolve()),
    } as never);
  });

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

  it("opens Telegram auth popup with the web link instead of leaving about:blank", async () => {
    const popup = {
      closed: false,
      opener: window,
      document: { title: "" },
      location: { href: "about:blank" },
      close: vi.fn(),
    } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(authApi.startTelegramAuth).mockResolvedValue({
      nonce: "n1",
      deepLink: "tg://resolve?domain=yallapharm_bot&start=auth_n1",
      appDeepLink: "tg://resolve?domain=yallapharm_bot&start=auth_n1",
      webDeepLink: "https://t.me/yallapharm_bot?start=auth_n1",
      botUsername: "yallapharm_bot",
      expiresAtUtc: "2026-06-09T14:00:00Z",
      ttlSeconds: 300,
    });

    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /Войти через Telegram/ }));

    expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => {
      expect(popup.location.href).toBe("https://t.me/yallapharm_bot?start=auth_n1");
    });
  });
});
