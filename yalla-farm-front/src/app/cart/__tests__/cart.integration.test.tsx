import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CartPage from "@/app/cart/page";
import { renderWithProviders } from "@/test/render";

vi.mock("@/shared/lib/useSignalR", () => ({
  useSignalREvent: vi.fn(),
}));

describe("CartPage", () => {
  it("guest with empty cart: shows the empty state", async () => {
    renderWithProviders(<CartPage />);
    expect(await screen.findByText(/Корзина пустая/)).toBeInTheDocument();
  });

  it("authenticated empty cart: shows the empty state (after fetch resolves to 0 positions)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ basketPositions: [], pharmacyOptions: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderWithProviders(<CartPage />, { preloadedAuth: { token: "t", role: "Client" } });
    expect(await screen.findByText(/Корзина пустая/)).toBeInTheDocument();
  });

  it("shows unavailable rows when basket medicines are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/basket")) {
          return Promise.resolve(new Response(JSON.stringify({
            basketPositions: [{ positionId: "pos-1", medicineId: "missing-med", quantity: 2 }],
            pharmacyOptions: [],
          }), { status: 200, headers: { "Content-Type": "application/json" } }));
        }
        if (url.endsWith("/api/medicines/by-ids")) {
          return Promise.resolve(new Response(JSON.stringify({ medicines: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }));
        }
        return Promise.resolve(new Response(JSON.stringify({ medicines: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }),
    );

    renderWithProviders(<CartPage />, { preloadedAuth: { token: "t", role: "Client" } });

    expect(await screen.findByText("Товар недоступен")).toBeInTheDocument();
    expect(screen.getByText(/Некоторые товары больше недоступны/)).toBeInTheDocument();
  });

  it("does not render the extra cart top bar", async () => {
    renderWithProviders(<CartPage />);
    await screen.findByText(/Корзина пустая/);
    expect(screen.queryByRole("heading", { name: "Корзина" })).not.toBeInTheDocument();
  });
});
