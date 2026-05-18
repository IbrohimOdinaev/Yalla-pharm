import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as navigation from "next/navigation";
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

  it("admin: shows workspace nav (Dashboard / Предложения / Заказы / Запросы)", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Предложения")).toBeInTheDocument();
    expect(screen.getByText("Заказы")).toBeInTheDocument();
    expect(screen.getByText("Запросы")).toBeInTheDocument();
    expect(screen.queryByText("Аптека")).not.toBeInTheDocument();
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

  it("pharmacist: shows Dashboard / Очередь / Корзина / Каталог / История", () => {
    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Pharmacist" },
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Очередь")).toBeInTheDocument();
    expect(screen.getByText("Корзина")).toBeInTheDocument();
    expect(screen.getByText("Каталог")).toBeInTheDocument();
    expect(screen.getByText("История")).toBeInTheDocument();
  });

  it("admin: at /workspace/lookups only Запросы is active", () => {
    vi.spyOn(navigation, "usePathname").mockReturnValue("/workspace/lookups");
    window.history.replaceState({}, "", "/workspace/lookups");

    renderWithProviders(<BottomNav />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });

    const dashboardTab = screen.getByRole("link", { name: "Dashboard" });
    const lookupsTab = screen.getByRole("link", { name: "Запросы" });

    expect(dashboardTab).not.toHaveClass("text-primary");
    expect(lookupsTab).toHaveClass("text-primary");
  });
});
