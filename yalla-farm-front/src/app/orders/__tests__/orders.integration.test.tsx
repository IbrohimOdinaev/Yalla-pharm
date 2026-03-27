import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrdersPage from "@/app/orders/page";
import { renderWithProviders } from "@/test/render";

vi.mock("@/shared/lib/useSignalR", () => ({
  useSignalREvent: vi.fn(),
}));

describe("OrdersPage", () => {
  it("guest: shows auth prompt", () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText("Требуется авторизация")).toBeInTheDocument();
  });

  it("authenticated: shows title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(screen.getByRole("heading", { name: "Мои заказы" })).toBeInTheDocument();
  });

  it("authenticated: shows empty state when no orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(
      await screen.findByText(/нет заказов/i)
    ).toBeInTheDocument();
  });

  it("shows order with computed cost from positions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            orders: [{
              orderId: "order-1",
              status: 0,
              cost: 0,
              orderPlacedAt: "2026-03-25T10:00:00Z",
              positions: [
                { positionId: "p1", medicineTitle: "Aspirin", quantity: 2, price: 50 }
              ]
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    // Cost should be computed from positions: 2 × 50 = 100
    expect(await screen.findByText("100.00 TJS")).toBeInTheDocument();
  });

  it("shows awaiting confirmation for unpaid orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            orders: [{
              orderId: "order-2",
              status: 0,
              cost: 200,
              paymentState: 1,
              orderPlacedAt: "2026-03-25T10:00:00Z",
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(await screen.findByText("Ожидает подтверждения")).toBeInTheDocument();
  });

  it("clears pending payment when order appears in history", async () => {
    window.localStorage.setItem(
      "yalla.front.pending.payment.intent",
      JSON.stringify({
        paymentIntentId: "pi-1",
        reservedOrderId: "order-123",
        paymentUrl: "http://pay.test",
        amount: 100,
        currency: "TJS",
      })
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            orders: [{
              orderId: "order-123",
              status: 1,
              cost: 100,
              orderPlacedAt: "2026-03-25T10:00:00Z",
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });

    await screen.findByText("100.00 TJS");
    await new Promise((r) => setTimeout(r, 200));

    expect(
      window.localStorage.getItem("yalla.front.pending.payment.intent")
    ).toBeNull();
  });
});
