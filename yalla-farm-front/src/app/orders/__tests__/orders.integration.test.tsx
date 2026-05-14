import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrdersPage from "@/app/orders/page";
import { renderWithProviders } from "@/test/render";

vi.mock("@/shared/lib/useSignalR", () => ({
  useSignalREvent: vi.fn(),
}));

describe("OrdersPage", () => {
  it("guest: shows the auth-required empty state", () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText("Требуется авторизация")).toBeInTheDocument();
  });

  it("authenticated: renders the «Мои заказы» heading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(screen.getByRole("heading", { name: "Мои заказы" })).toBeInTheDocument();
  });

  it("authenticated empty: shows the «нет заказов» empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderWithProviders(<OrdersPage />, {
      preloadedAuth: { token: "t", role: "Client" },
    });
    expect(await screen.findByText(/нет заказов/i)).toBeInTheDocument();
  });

  // The "clear pending payment intent on history-match" path is exercised
  // via real-time order status SignalR events plus a refetch — it doesn't
  // fire from the initial bulk fetch alone in the current implementation.
  // Covered by the e2e payment-flow spec; not retried here.
});
