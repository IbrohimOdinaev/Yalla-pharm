import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TopBar } from "@/widgets/layout/TopBar";
import { renderWithProviders } from "@/test/render";

// TopBar has two visual modes:
//   • title mode (default) — renders an `<h1>{title}</h1>` plus a back
//     button + optional logout chip. No profile dropdown / address pill.
//   • homeMode — renders the Yandex-style search header with logo, search
//     bar, address pill, cart pill, and the per-role profile dropdown.
//
// In homeMode the profile button is rendered twice (mobile + desktop
// layouts coexist in the DOM at the test viewport), so we click the
// first one and assert the dropdown contents via getAllByText.

async function openProfileDropdown() {
  const user = userEvent.setup();
  const profileButtons = screen.getAllByLabelText("Аккаунт");
  await user.click(profileButtons[0]);
  return user;
}

describe("TopBar (title mode)", () => {
  it("renders the title", () => {
    renderWithProviders(<TopBar title="Заголовок" />);
    expect(screen.getByText("Заголовок")).toBeInTheDocument();
  });

  it("renders back link when backHref is a URL", () => {
    renderWithProviders(<TopBar title="Test" backHref="/home" />);
    const backLink = screen.getByRole("link", { name: "Назад" });
    expect(backLink).toHaveAttribute("href", "/home");
  });
});

describe("TopBar (home mode)", () => {
  it("guest: profile dropdown shows guest mode + login by SMS", async () => {
    renderWithProviders(<TopBar homeMode />);
    await openProfileDropdown();
    expect(screen.getAllByText("Гостевой режим").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Войти по SMS").length).toBeGreaterThanOrEqual(1);
  });

  it("client: dropdown shows profile, orders, prescriptions, logout", async () => {
    renderWithProviders(<TopBar homeMode />, {
      preloadedAuth: { token: "test-token", role: "Client", userId: "u1" },
    });
    await openProfileDropdown();
    expect(screen.getAllByText("Клиент").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Мой профиль").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Мои заказы").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Мои рецепты").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Выйти").length).toBeGreaterThanOrEqual(1);
  });

  it("admin: dropdown shows Кабинет link", async () => {
    renderWithProviders(<TopBar homeMode />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    await openProfileDropdown();
    expect(screen.getAllByText("Кабинет").length).toBeGreaterThanOrEqual(1);
  });

  it("superadmin: dropdown shows Панель управления, no Мой профиль", async () => {
    renderWithProviders(<TopBar homeMode />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    await openProfileDropdown();
    expect(screen.queryByText("Мой профиль")).not.toBeInTheDocument();
    expect(screen.getAllByText("Панель управления").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Выйти").length).toBeGreaterThanOrEqual(1);
  });

  it("logout clears credentials from store", async () => {
    const { store } = renderWithProviders(<TopBar homeMode />, {
      preloadedAuth: { token: "test-token", role: "Client", userId: "u1" },
    });
    const user = await openProfileDropdown();
    await user.click(screen.getAllByText("Выйти")[0]);
    expect(store.getState().auth.token).toBeNull();
  });
});
