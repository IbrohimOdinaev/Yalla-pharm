import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SuperAdminPage from "@/app/superadmin/page";
import { renderWithProviders } from "@/test/render";

function mockSuperAdminFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/admins")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              admins: [{ adminId: "a1", name: "Admin1", phoneNumber: "901010101" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/pharmacies")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              pharmacies: [{ id: "p1", title: "Pharmacy1", address: "Addr1", isActive: true }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/medicines")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ medicines: [{ id: "m1", title: "Med1" }], totalCount: 1 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/clients")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              clients: [{ clientId: "c1", name: "Client1", phoneNumber: "900111222" }],
            }),
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

// /superadmin is now a hard auth-gated screen: when role !== SuperAdmin
// the component returns `null` so the auth-redirect side-effect can move
// the user without flashing an "Access denied" stub. Tests reflect that.
describe("SuperAdminPage", () => {
  it("guest: renders nothing (auth guard)", () => {
    const { container } = renderWithProviders(<SuperAdminPage />);
    expect(container.firstChild).toBeNull();
  });

  it("admin role: renders nothing (auth guard)", () => {
    const { container } = renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(container.firstChild).toBeNull();
  });

  it("superadmin: renders the hero", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(await screen.findByText("SuperAdmin Control")).toBeInTheDocument();
    expect(screen.getByText("Глобальное управление системой")).toBeInTheDocument();
  });

  it("superadmin: renders the stats dashboard labels", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(await screen.findByText("Заказы сегодня")).toBeInTheDocument();
    expect(screen.getByText("Успешные")).toBeInTheDocument();
    expect(screen.getByText("Расход доставки")).toBeInTheDocument();
    expect(screen.getByText("Аптеки по обороту сегодня")).toBeInTheDocument();
  });

  it("superadmin: pharmacies tab heading shows by default", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(
      await screen.findByText("Управление аптеками и администраторами"),
    ).toBeInTheDocument();
  });
});
