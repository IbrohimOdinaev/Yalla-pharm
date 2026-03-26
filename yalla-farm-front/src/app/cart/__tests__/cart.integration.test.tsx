import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CartPage from "@/app/cart/page";
import { renderWithProviders } from "@/test/render";

vi.mock("@/shared/lib/useSignalR", () => ({
  useSignalREvent: vi.fn(),
}));

describe("CartPage", () => {
  it("guest with empty cart: shows empty message", () => {
    renderWithProviders(<CartPage />);
    expect(screen.getByText(/Корзина пустая/)).toBeInTheDocument();
  });

  it("guest with items in cart: shows auth prompt for checkout", async () => {
    window.localStorage.setItem(
      "yalla.guest.basket.v1",
      JSON.stringify({ items: [{ medicineId: "med-1", quantity: 2 }] })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            medicine: { id: "med-1", title: "TestMed", price: 10, images: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<CartPage />);
    expect(await screen.findByText("Войти и оформить")).toBeInTheDocument();
  });

  it("authenticated: shows cart title", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ positions: [], pharmacyOptions: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<CartPage />, { preloadedAuth: { token: "t", role: "Client" } });
    expect(screen.getByRole("heading", { name: "Корзина" })).toBeInTheDocument();
  });

  it("guest checkout shows login/register buttons", async () => {
    window.localStorage.setItem(
      "yalla.guest.basket.v1",
      JSON.stringify({
        items: [{ medicineId: "med-1", quantity: 1 }],
      })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            medicine: {
              id: "med-1",
              title: "Test",
              offers: [
                { pharmacyId: "p1", price: 10, stockQuantity: 5 },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    renderWithProviders(<CartPage />);

    expect(await screen.findByText("Войти и оформить")).toBeInTheDocument();
    expect(screen.getByText("Регистрация")).toBeInTheDocument();
  });
});
