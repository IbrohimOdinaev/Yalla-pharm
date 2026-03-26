import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TopBar } from "@/widgets/layout/TopBar";
import { renderWithProviders } from "@/test/render";

describe("TopBar", () => {
  it("renders title and location", () => {
    renderWithProviders(<TopBar title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Dushanbe, RT")).toBeInTheDocument();
  });

  it("renders back button when backHref provided", () => {
    renderWithProviders(<TopBar title="Test" backHref="/home" />);
    const backLink = screen.getByRole("link");
    expect(backLink).toHaveAttribute("href", "/home");
  });

  it("shows Душанбе badge", () => {
    renderWithProviders(<TopBar title="Test" />);
    expect(screen.getByText("Душанбе")).toBeInTheDocument();
  });

  it("guest: shows login and register in dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopBar title="Test" />);

    await user.click(screen.getByLabelText("Аккаунт"));

    expect(screen.getByText("Гостевой режим")).toBeInTheDocument();
    expect(screen.getByText("Войти")).toBeInTheDocument();
    expect(screen.getByText("Регистрация")).toBeInTheDocument();
  });

  it("authenticated client: shows profile and logout", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopBar title="Test" />, {
      preloadedAuth: { token: "test-token", role: "Client", userId: "u1" },
    });

    await user.click(screen.getByLabelText("Аккаунт"));

    expect(screen.getByText("Клиент")).toBeInTheDocument();
    expect(screen.getByText("Мой профиль")).toBeInTheDocument();
    expect(screen.getByText("Выйти")).toBeInTheDocument();
  });

  it("admin: shows workspace link", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopBar title="Test" />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });

    await user.click(screen.getByLabelText("Аккаунт"));
    expect(screen.getByText("Кабинет")).toBeInTheDocument();
  });

  it("superadmin: shows panel link", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopBar title="Test" />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });

    await user.click(screen.getByLabelText("Аккаунт"));
    expect(screen.getByText("Панель управления")).toBeInTheDocument();
  });

  it("logout clears credentials from store", async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<TopBar title="Test" />, {
      preloadedAuth: { token: "test-token", role: "Client", userId: "u1" },
    });

    await user.click(screen.getByLabelText("Аккаунт"));
    await user.click(screen.getByText("Выйти"));

    expect(store.getState().auth.token).toBeNull();
  });

  it("closes dropdown on outside click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <div>
        <TopBar title="Test" />
        <div data-testid="outside">outside</div>
      </div>,
    );

    await user.click(screen.getByLabelText("Аккаунт"));
    expect(screen.getByText("Гостевой режим")).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByText("Гостевой режим")).not.toBeInTheDocument();
  });

  it("superadmin: no profile link in dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TopBar title="Test" />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });

    await user.click(screen.getByLabelText("Аккаунт"));
    expect(screen.queryByText("Мой профиль")).not.toBeInTheDocument();
    expect(screen.getByText("Панель управления")).toBeInTheDocument();
    expect(screen.getByText("Выйти")).toBeInTheDocument();
  });
});
