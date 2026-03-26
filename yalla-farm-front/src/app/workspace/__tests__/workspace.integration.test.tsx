import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkspacePage from "@/app/workspace/page";
import { renderWithProviders } from "@/test/render";

function mockAdminFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/orders/admin")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              orders: [
                { orderId: "o1", status: "New", cost: 100, positions: [] },
                { orderId: "o2", status: "Preparing", cost: 200, positions: [] },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/pharmacies")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              pharmacies: [
                { id: "ph1", title: "Аптека Тест", address: "ул. Тестовая", isActive: true },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/admins/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ name: "AdminTest", phoneNumber: "901010101" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
      );
    })
  );
}

describe("WorkspacePage", () => {
  it("non-admin: shows access denied", () => {
    renderWithProviders(<WorkspacePage />);
    expect(screen.getByText(/Доступ только для администраторов/)).toBeInTheDocument();
  });

  it("non-admin client: shows access denied", () => {
    renderWithProviders(<WorkspacePage />, { preloadedAuth: { token: "t", role: "Client" } });
    expect(screen.getByText(/Доступ только для администраторов/)).toBeInTheDocument();
  });

  it("admin: shows dashboard hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("admin: shows pharmacy name in hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    expect(await screen.findByText(/Аптека Тест/)).toBeInTheDocument();
  });

  it("admin: shows stat cards", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    expect(await screen.findByText("Заказы в ленте")).toBeInTheDocument();
    expect(screen.getByText("Статус аптеки")).toBeInTheDocument();
    expect(screen.getByText("Администратор")).toBeInTheDocument();
  });
});
