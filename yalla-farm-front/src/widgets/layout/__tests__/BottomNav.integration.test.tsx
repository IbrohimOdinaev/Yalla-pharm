import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomNav } from "@/widgets/layout/BottomNav";
import { renderWithProviders } from "@/test/render";

// BottomNav is staff-only — client + guest get an empty render. Admin,
// SuperAdmin and Pharmacist each see their own set of section links.
describe("BottomNav", () => {
  it("guest: renders nothing", () => {
    const { container } = renderWithProviders(<BottomNav />);
    expect(container.firstChild).toBeNull();
  });

  it("client: renders nothing", () => {
    const { container } = renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(container.firstChild).toBeNull();
  });

  it("admin: shows workspace nav (Аптека / Предложения / Заказы / Запросы)", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(screen.getByText("Аптека")).toBeInTheDocument();
    expect(screen.getByText("Предложения")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.getByText("Запросы")).toBeInTheDocument();
    expect(screen.queryByText("Каталог")).not.toBeInTheDocument();
    expect(screen.queryByText("Корзина")).not.toBeInTheDocument();
    expect(screen.queryByText("Профиль")).not.toBeInTheDocument();
  });

  it("superadmin: shows Аптеки / Лекарства / Заказы / Рецепты", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "SuperAdmin" },
    });
    expect(screen.getByText("Аптеки")).toBeInTheDocument();
    expect(screen.getByText("Лекарства")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.getByText("Рецепты")).toBeInTheDocument();
    expect(screen.queryByText("Корзина")).not.toBeInTheDocument();
    expect(screen.queryByText("Профиль")).not.toBeInTheDocument();
  });

  it("pharmacist: shows Очередь / Корзина / Каталог / История", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Pharmacist" },
    });
    expect(screen.getByText("Очередь")).toBeInTheDocument();
    expect(screen.getByText("Корзина")).toBeInTheDocument();
    expect(screen.getByText("Каталог")).toBeInTheDocument();
    expect(screen.getByText("История")).toBeInTheDocument();
  });
});
