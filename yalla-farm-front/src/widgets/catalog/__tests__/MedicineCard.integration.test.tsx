import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { renderWithProviders } from "@/test/render";
import type { ApiMedicine } from "@/shared/types/api";

function makeMedicine(overrides: Partial<ApiMedicine> = {}): ApiMedicine {
  return {
    id: "m1",
    title: "Парацетамол",
    name: "Парацетамол",
    articul: "ART-001",
    images: [],
    offers: [],
    atributes: [],
    ...overrides,
  } as ApiMedicine;
}

describe("MedicineCard", () => {
  it("renders medicine title", () => {
    renderWithProviders(<MedicineCard medicine={makeMedicine()} />);
    expect(screen.getByText("Парацетамол")).toBeInTheDocument();
  });

  it("renders add-to-cart button with price", () => {
    const med = makeMedicine({ offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 25 }] });
    renderWithProviders(<MedicineCard medicine={med} />);
    // The price+add button row should exist
    expect(screen.getByLabelText("Добавить в корзину")).toBeInTheDocument();
  });

  it("shows cheapest price from offers, not medicine.price", () => {
    const med = makeMedicine({
      price: 100,
      offers: [
        { pharmacyId: "p1", stockQuantity: 5, price: 50 },
        { pharmacyId: "p2", stockQuantity: 3, price: 30 },
      ],
    });
    renderWithProviders(<MedicineCard medicine={med} />);
    // Cheapest offer is 30, formatted as "30.00 TJS"
    expect(screen.getByText("30.00 TJS")).toBeInTheDocument();
  });

  it("shows attributes", () => {
    const med = makeMedicine({
      atributes: [
        { name: "Форма", option: "Таблетки" },
        { name: "Дозировка", option: "500мг" },
      ],
    });
    renderWithProviders(<MedicineCard medicine={med} />);
    expect(screen.getByText("Таблетки")).toBeInTheDocument();
    expect(screen.getByText("500мг")).toBeInTheDocument();
  });

  it("uses minimal image URL when available", () => {
    const med = makeMedicine({
      images: [
        { id: "img-main", isMain: true, isMinimal: false },
        { id: "img-min", isMain: false, isMinimal: true },
      ],
    });
    renderWithProviders(<MedicineCard medicine={med} />);
    const img = screen.getByRole("img");
    // Minimal image should be preferred for the card thumbnail
    expect(img.getAttribute("src")).toContain("img-min");
  });

  it("hideCart mode shows price without add button", () => {
    const med = makeMedicine({
      offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 25 }],
    });
    renderWithProviders(<MedicineCard medicine={med} hideCart />);
    expect(screen.getByText("25.00 TJS")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Добавить в корзину")
    ).not.toBeInTheDocument();
  });

  it("shows price in аптеке when no offers", () => {
    const med = makeMedicine({ offers: [] });
    renderWithProviders(<MedicineCard medicine={med} />);
    expect(screen.getByText("Цена в аптеке")).toBeInTheDocument();
  });
});
