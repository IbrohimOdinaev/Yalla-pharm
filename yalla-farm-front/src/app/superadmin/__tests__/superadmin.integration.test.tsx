import React from "react";
import { fireEvent, screen } from "@testing-library/react";
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

  it("superadmin: pharmacies tab heading shows when hash is pharmacies", async () => {
    window.history.replaceState({}, "", "/superadmin#pharmacies");
    mockSuperAdminFetch();
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });
    expect(
      await screen.findByText("Управление аптеками и администраторами"),
    ).toBeInTheDocument();
  });

  it("superadmin finance: opens payout QR on a separate page", async () => {
    const deepLinkUrl = "https://alifmobi.page.link/toMobi?account=+992988122731&summa=6.00&_imcp=1";
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/pharmacy-finance/superadmin/withdrawals")) {
          return Promise.resolve(
            new Response(JSON.stringify({ summary: {}, withdrawalRequests: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.includes("/api/staff-compensation/payout-requests")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                payoutRequests: [
                  {
                    id: "pay-1",
                    staffUserId: "staff-1",
                    staffName: "A1",
                    staffPhoneNumber: "902020202",
                    staffRole: "Admin",
                    pharmacyTitle: "Nishon",
                    amount: 6,
                    currency: "TJS",
                    bank: "Alif",
                    bankLabel: "Alif Mobi",
                    walletPhoneNumber: "992988122731",
                    deepLinkUrl,
                    status: "New",
                    createdAtUtc: "2026-06-13T12:08:00Z",
                  },
                ],
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

    window.history.replaceState({}, "", "/superadmin#finance");
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });

    expect(await screen.findByText("A1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Открыть QR для скана" }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/payment-qr?url=https%3A%2F%2Falifmobi.page.link%2FtoMobi"),
      "_blank",
      "noopener,noreferrer",
    );
    const openedUrl = String(openSpy.mock.calls[0][0]);
    expect(openedUrl).toContain(encodeURIComponent(deepLinkUrl));
    expect(screen.queryByRole("dialog", { name: "QR для выплаты" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/superadmin");
    expect(window.location.hash).toBe("#finance");
  });

  it("superadmin finance: gives request statuses clearly different colors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/pharmacy-finance/superadmin/withdrawals")) {
          return Promise.resolve(
            new Response(JSON.stringify({
              summary: {},
              withdrawalRequests: [
                {
                  id: "w-new",
                  pharmacyId: "p1",
                  pharmacyTitle: "New Pharmacy",
                  requestedByAdminId: "a1",
                  requestedByAdminName: "Admin",
                  requestedByAdminPhoneNumber: "900000001",
                  amount: 10,
                  currency: "TJS",
                  bank: "DushanbeCity",
                  bankLabel: "Dushanbe City",
                  walletPhoneNumber: "992900000001",
                  deepLinkUrl: "dushanbecity://transfer?phone=992900000001&amount=10.00",
                  status: "New",
                  createdAtUtc: "2026-06-13T12:08:00Z",
                },
                {
                  id: "w-done",
                  pharmacyId: "p2",
                  pharmacyTitle: "Done Pharmacy",
                  requestedByAdminId: "a2",
                  requestedByAdminName: "Admin",
                  requestedByAdminPhoneNumber: "900000002",
                  amount: 20,
                  currency: "TJS",
                  bank: "Alif",
                  bankLabel: "Alif Mobi",
                  walletPhoneNumber: "992900000002",
                  deepLinkUrl: "https://alifmobi.page.link/toMobi?account=+992900000002&summa=20.00&_imcp=1",
                  status: "Completed",
                  createdAtUtc: "2026-06-13T12:08:00Z",
                },
              ],
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.includes("/api/staff-compensation/payout-requests")) {
          return Promise.resolve(
            new Response(JSON.stringify({ payoutRequests: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }),
    );

    window.history.replaceState({}, "", "/superadmin#finance");
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });

    const newBadge = await screen.findByText("Новый");
    const completedBadge = await screen.findByText("Выполненный");
    expect(newBadge).toHaveClass("bg-orange-100", "text-orange-800");
    expect(completedBadge).toHaveClass("bg-emerald-100", "text-emerald-800");
  });

  it("superadmin delivery: shows delivery accounting by order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/orders/all")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                orders: [
                  {
                    orderId: "delivery1",
                    status: "Delivered",
                    pharmacyTitle: "Nishon",
                    clientName: "Client Delivery",
                    cost: 100,
                    deliveryCost: 15,
                    totalCost: 115,
                    currency: "TJS",
                    isPickup: false,
                    deliveryAddress: "Client point B",
                    deliveryDistance: 4.2,
                    fromLatitude: 38.58001,
                    fromLongitude: 68.78001,
                    toLatitude: 38.59001,
                    toLongitude: 68.79001,
                    juraOrderId: 501,
                    juraStatus: "created",
                    createdAtUtc: "2026-06-13T12:08:00Z",
                    positions: [],
                  },
                ],
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

    window.history.replaceState({}, "", "/superadmin#delivery");
    renderWithProviders(<SuperAdminPage />, {
      preloadedAuth: { token: "t", role: "SuperAdmin", userId: "u1" },
    });

    expect(await screen.findByText("Учёт доставки по заказам")).toBeInTheDocument();
    expect(screen.getByText("Nishon → Client Delivery")).toBeInTheDocument();
    expect(screen.getAllByText("4.2 км").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("115.00 TJS")).toBeInTheDocument();
    expect(screen.getByText("Jura #501")).toBeInTheDocument();
  });
});
