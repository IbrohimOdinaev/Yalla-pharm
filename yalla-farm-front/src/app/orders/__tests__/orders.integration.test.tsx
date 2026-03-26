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

  it("authenticated: shows filter buttons", async () => {
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
    expect(await screen.findByText("Все")).toBeInTheDocument();
    expect(screen.getByText("В процессе")).toBeInTheDocument();
    expect(screen.getByText("Выполнены")).toBeInTheDocument();
    expect(screen.getByText("Отменены")).toBeInTheDocument();
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

  it("clears pending payment when order appears in history", async () => {
    // Set pending payment
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
            orders: [
              {
                orderId: "order-123",
                status: 1,
                cost: 100,
                orderPlacedAt: "2026-03-25T10:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });

    // Wait for orders to load and cleanup effect to run
    await screen.findByText("Все");
    await new Promise((r) => setTimeout(r, 200));

    expect(
      window.localStorage.getItem("yalla.front.pending.payment.intent")
    ).toBeNull();
  });
});
