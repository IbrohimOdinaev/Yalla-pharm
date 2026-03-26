import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductDetailsPage from "@/app/product/[id]/page";
import { renderWithProviders } from "@/test/render";

function mockProductFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/medicines/test-id")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              medicine: {
                id: "test-id",
                title: "Аспирин",
                articul: "ASP-100",
                images: [
                  { id: "img-main", isMain: true, isMinimal: false },
                  { id: "img-min", isMain: false, isMinimal: true },
                  { id: "img-reg", isMain: false, isMinimal: false },
                ],
                atributes: [
                  { name: "Дозировка", option: "100мг" },
                  { name: "Форма", option: "Таблетки" },
                ],
                offers: [
                  { pharmacyId: "p1", pharmacyTitle: "Аптека Центр", stockQuantity: 10, price: 15.5 },
                  { pharmacyId: "p2", pharmacyTitle: "Аптека Юг", stockQuantity: 5, price: 12.0 },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("/api/basket")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ positions: [], pharmacyOptions: [] }),
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

describe("ProductDetailsPage", () => {
  it("shows medicine title after fetch", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Аспирин")).toBeInTheDocument();
  });

  it("shows articul", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("ASP-100")).toBeInTheDocument();
  });

  it("shows attributes", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Дозировка")).toBeInTheDocument();
    expect(screen.getByText("100мг")).toBeInTheDocument();
    expect(screen.getByText("Форма")).toBeInTheDocument();
    expect(screen.getByText("Таблетки")).toBeInTheDocument();
  });

  it("shows cheapest price", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    const priceElements = await screen.findAllByText(/12\.00/);
    expect(priceElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows pharmacy offers", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Аптека Центр")).toBeInTheDocument();
    expect(screen.getByText("Аптека Юг")).toBeInTheDocument();
  });

  it("shows quantity selector", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Добавить в корзину")).toBeInTheDocument();
  });

  it("shows gallery thumbnails for multiple images", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    await screen.findByText("Аспирин");
    // Gallery should have 2 thumbnails (main + regular, no minimal)
    const images = document.querySelectorAll("button img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it("shows admin tip for Admin role", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(await screen.findByText(/Режим Администратора/)).toBeInTheDocument();
  });
});
