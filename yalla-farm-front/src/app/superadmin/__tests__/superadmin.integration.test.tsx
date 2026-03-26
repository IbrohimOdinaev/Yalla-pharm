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
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/pharmacies")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              pharmacies: [{ id: "p1", title: "Pharmacy1", address: "Addr1", isActive: true }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/medicines")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ medicines: [{ id: "m1", title: "Med1" }], totalCount: 1 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/clients")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              clients: [{ clientId: "c1", name: "Client1", phoneNumber: "900111222" }],
            }),
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

describe("SuperAdminPage", () => {
  it("non-superadmin: shows access denied", () => {
    renderWithProviders(<SuperAdminPage />);
    expect(screen.getByText(/Доступ только для суперадминистраторов/)).toBeInTheDocument();
  });

  it("admin role: shows access denied", () => {
    renderWithProviders(<SuperAdminPage />, { preloadedAuth: { token: "t", role: "Admin" } });
    expect(screen.getByText(/Доступ только для суперадминистраторов/)).toBeInTheDocument();
  });

  it("superadmin: shows hero", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(await screen.findByText("SuperAdmin Control")).toBeInTheDocument();
    expect(screen.getByText("Глобальное управление системой")).toBeInTheDocument();
  });

  it("superadmin: shows stats dashboard", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(await screen.findByText("Админы")).toBeInTheDocument();
    // "Аптеки" and "Лекарства" also appear in BottomNav, so use getAllByText
    expect(screen.getAllByText("Аптеки").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Лекарства").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Клиенты").length).toBeGreaterThanOrEqual(1);
  });

  it("superadmin: pharmacies tab shows by default", async () => {
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(await screen.findByText("Управление аптеками и администраторами")).toBeInTheDocument();
  });
});
