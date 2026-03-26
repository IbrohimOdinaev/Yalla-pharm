import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomNav } from "@/widgets/layout/BottomNav";
import { renderWithProviders } from "@/test/render";

describe("BottomNav", () => {
  it("guest: shows same nav as client (Каталог, Корзина, Заказы, Профиль)", () => {
    renderWithProviders(<BottomNav />);
    expect(screen.getByText("Каталог")).toBeInTheDocument();
    expect(screen.getByText("Корзина")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.getByText("Профиль")).toBeInTheDocument();
    expect(screen.queryByText("Войти")).not.toBeInTheDocument();
  });

  it("client: shows Каталог, Корзина, Заказы, Профиль", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(screen.getByText("Каталог")).toBeInTheDocument();
    expect(screen.getByText("Корзина")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.getByText("Профиль")).toBeInTheDocument();
  });

  it("admin: shows workspace-specific nav (Аптека, Предложения, Заказы)", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(screen.getByText("Аптека")).toBeInTheDocument();
    expect(screen.getByText("Предложения")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.queryByText("Каталог")).not.toBeInTheDocument();
    expect(screen.queryByText("Корзина")).not.toBeInTheDocument();
    expect(screen.queryByText("Профиль")).not.toBeInTheDocument();
  });

  it("superadmin: shows Аптеки, Лекарства, Заказы", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "SuperAdmin" },
    });
    expect(screen.getByText("Аптеки")).toBeInTheDocument();
    expect(screen.getByText("Лекарства")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.queryByText("Панель")).not.toBeInTheDocument();
    expect(screen.queryByText("Корзина")).not.toBeInTheDocument();
    expect(screen.queryByText("Профиль")).not.toBeInTheDocument();
  });
});
