import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductDetailsPage from "@/app/product/[id]/page";
import { renderWithProviders } from "@/test/render";

// useParams() resolves to { id: "test-id" } via the global mock. That's
// not a UUID, so the page calls getMedicineBySlug — the mock below has
// to answer `/api/medicines/by-slug/test-id` (not the by-id variant).
function mockProductFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/medicines/by-slug/test-id") || url.includes("/api/medicines/test-id")) {
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
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/basket")) {
        return Promise.resolve(
          new Response(JSON.stringify({ positions: [], pharmacyOptions: [] }), {
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
}

describe("ProductDetailsPage", () => {
  it("renders medicine title", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Аспирин")).toBeInTheDocument();
  });

  it("renders the articul row", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Артикул: ASP-100")).toBeInTheDocument();
  });

  it("renders the attribute key + value", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Дозировка")).toBeInTheDocument();
    expect(screen.getByText("100мг")).toBeInTheDocument();
    expect(screen.getByText("Форма")).toBeInTheDocument();
    expect(screen.getByText("Таблетки")).toBeInTheDocument();
  });

  it("renders the cheapest price (12.00)", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect((await screen.findAllByText(/12\.00/)).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the pharmacy offers list", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    expect(await screen.findByText("Аптека Центр")).toBeInTheDocument();
    expect(screen.getByText("Аптека Юг")).toBeInTheDocument();
  });

  it("renders the «В корзину» CTA", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />);
    // Button text is "В корзину · 12.00 TJS" when a price is known; match
    // the leading phrase.
    expect((await screen.findAllByText(/В корзину/)).length).toBeGreaterThanOrEqual(1);
  });

  it("shows admin-mode banner for Admin role", async () => {
    mockProductFetch();
    renderWithProviders(<ProductDetailsPage />, {
      preloadedAuth: { token: "t", role: "Admin" },
    });
    expect(await screen.findByText(/Режим администратора/)).toBeInTheDocument();
  });
});
