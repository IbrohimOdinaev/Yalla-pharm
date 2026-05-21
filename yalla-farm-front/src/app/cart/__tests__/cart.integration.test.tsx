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

  it("does not render the extra cart top bar", async () => {
    renderWithProviders(<CartPage />);
    await screen.findByText(/Корзина пустая/);
    expect(screen.queryByRole("heading", { name: "Корзина" })).not.toBeInTheDocument();
  });
});
