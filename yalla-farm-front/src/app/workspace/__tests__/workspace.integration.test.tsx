import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkspacePage from "@/app/workspace/page";
import { renderWithProviders } from "@/test/render";

vi.mock("@/widgets/map/DispatchRouteMap", () => ({
  DispatchRouteMap: () => <div data-testid="dispatch-route-map" />,
}));

function mockAdminFetch(orders: Record<string, unknown>[] = [
  { orderId: "o1", status: "New", cost: 100, positions: [] },
  { orderId: "o2", status: "Preparing", cost: 200, positions: [] },
]) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/api/orders/admin")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            orders,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (requestUrl.includes("/api/pharmacy-workers/mine/admins")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            admins: [
              { id: "admin-worker-1", name: "Worker Admin", phoneNumber: "900000012", pharmacyId: "ph1" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (requestUrl.includes("/api/delivery/tariffs")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { id: 1, name: "Курьер на авто", divisionId: 10 },
            { id: 2, name: "Велокурьер", divisionId: 11 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (requestUrl.includes("/api/delivery/calculate")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ deliveryCost: 16, distance: 2.1 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (requestUrl.includes("/delivery/dispatch")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            orderId: "ready001",
            juraOrderId: 501,
            juraStatus: "created",
            juraStatusId: 1,
            deliveryCost: 16,
            alreadyDispatched: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (requestUrl.includes("/api/orders/on-the-way")) {
      return Promise.resolve(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }
    if (requestUrl.includes("/api/pharmacies")) {
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
    if (requestUrl.includes("/api/admins/me")) {
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
    });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  window.location.hash = "";
});

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

  it("pharmacy account: shows the Admin Dashboard hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1" },
    });
    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("pharmacy account: shows the pharmacy name in the hero", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1" },
    });
    expect((await screen.findAllByText(/Аптека Тест/)).length).toBeGreaterThanOrEqual(1);
  });

  it("pharmacy account: shows the stat-card labels", async () => {
    mockAdminFetch();
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1" },
    });
    expect(await screen.findByText("Заказы сегодня")).toBeInTheDocument();
    expect(screen.getByText("Отменённые")).toBeInTheDocument();
    expect(screen.getByText("Возвраты")).toBeInTheDocument();
    expect(screen.getByText("Оборот")).toBeInTheDocument();
  });

  it("pharmacy account dashboard: shows recent orders with finance breakdown", async () => {
    mockAdminFetch([
      {
        orderId: "finance1",
        status: "Delivered",
        cost: 100,
        deliveryCost: 16,
        totalCost: 116,
        isPickup: false,
        clientName: "Client Finance",
        deliveryAddress: "Client street",
        createdAtUtc: "2026-06-13T08:00:00Z",
        positions: [],
      },
    ]);
    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1" },
    });

    expect(await screen.findByText("Последние заказы")).toBeInTheDocument();
    expect(screen.getByText("Client Finance")).toBeInTheDocument();
    expect(screen.getByText("Товары")).toBeInTheDocument();
    expect(screen.getAllByText("Доставка").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Итого")).toBeInTheDocument();
    expect(screen.getByText("116.00 TJS")).toBeInTheDocument();
  });

  it("pharmacy account orders: hides the New column and shows New orders under review", async () => {
    window.location.hash = "#orders";
    mockAdminFetch([
      { orderId: "new00001", status: "New", cost: 100, positions: [], createdAtUtc: "2026-06-05T08:00:00Z" },
      { orderId: "review01", status: "UnderReview", cost: 120, positions: [], createdAtUtc: "2026-06-05T08:10:00Z" },
    ]);

    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1" },
    });

    expect(await screen.findByText("Order Board")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Новые" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "На рассмотрении" })).toBeInTheDocument();
    expect(screen.getByText("#new00001")).toBeInTheDocument();
    expect(screen.getByText("#review01")).toBeInTheDocument();
  });

  it("pharmacy account orders: opens courier dispatch from the Ready card and moves order on the way after confirm", async () => {
    window.location.hash = "#orders";
    const fetchMock = mockAdminFetch([
      {
        orderId: "ready001",
        status: "Ready",
        cost: 218,
        positions: [],
        isPickup: false,
        pharmacyId: "ph1",
        pharmacyTitle: "Аптека Тест",
        deliveryAddress: "Ulitsa Yakka-Chinarskaya 148",
        fromLatitude: 38.58,
        fromLongitude: 68.78,
        toLatitude: 38.56,
        toLongitude: 68.77,
        createdAtUtc: "2026-06-05T08:00:00Z",
      },
    ]);

    renderWithProviders(<WorkspacePage />, {
      preloadedAuth: { token: "t", role: "PharmacyAccount", userId: "u1", pharmacyId: "ph1" },
    });

    await userEvent.click(await screen.findByRole("button", { name: "В пути" }));

    expect(await screen.findByRole("heading", { name: "Вызвать доставку" })).toBeInTheDocument();
    expect(screen.getByText("Курьер на авто")).toBeInTheDocument();
    expect(screen.queryByText("Велокурьер")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await screen.findByText("Управление заказами");
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes("/api/orders/ready001/delivery/dispatch"))).toBe(true);
    expect(calledUrls.some((url) => url.includes("/api/orders/on-the-way"))).toBe(false);
  });
});
