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
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
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
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/admins/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ name: "AdminTest", phoneNumber: "901010101" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }),
  );
}

// /workspace is the admin's home. Like /superadmin it now returns `null`
// for non-matching roles so the auth-redirect can hand the user off
// without flashing an "Access denied" stub.
describe("WorkspacePage", () => {
  it("guest: renders nothing (auth guard)", () => {
    const { container } = renderWithProviders(<WorkspacePage />);
    expect(container.firstChild).toBeNull();
  });

  it("client role: renders nothing (auth guard)", () => {
    const { container } = renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(container.firstChild).toBeNull();
  });

  it("admin: shows the Admin Dashboard hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("admin: shows the pharmacy name in the hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    expect(await screen.findByText(/Аптека Тест/)).toBeInTheDocument();
  });

  it("admin: shows the stat-card labels", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "Admin", userId: "u1" },
    });
    // "Заказы" also appears in the BottomNav strip — pick any.
    expect((await screen.findAllByText("Заказы")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Статус аптеки")).toBeInTheDocument();
    expect(screen.getByText("Администратор")).toBeInTheDocument();
  });
});
