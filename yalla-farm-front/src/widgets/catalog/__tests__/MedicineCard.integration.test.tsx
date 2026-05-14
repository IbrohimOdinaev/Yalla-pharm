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

  it("renders add-to-cart pill with price", () => {
    const med = makeMedicine({ offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 25 }] });
    renderWithProviders(<MedicineCard medicine={med} />);
    // Card's add affordance uses aria-label "В корзину".
    expect(screen.getByLabelText("В корзину")).toBeInTheDocument();
  });

  it("shows cheapest price from offers prefixed with «от»", () => {
    const med = makeMedicine({
      price: 100,
      offers: [
        { pharmacyId: "p1", stockQuantity: 5, price: 50 },
        { pharmacyId: "p2", stockQuantity: 3, price: 30 },
      ],
    });
    renderWithProviders(<MedicineCard medicine={med} />);
    // Pill text reads "от 30.00 TJS"
    expect(screen.getByText("от 30.00 TJS")).toBeInTheDocument();
  });

  it("hideCart mode shows price without add affordance", () => {
    const med = makeMedicine({
      offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 25 }],
    });
    renderWithProviders(<MedicineCard medicine={med} hideCart />);
    expect(screen.getByText("от 25.00 TJS")).toBeInTheDocument();
    expect(screen.queryByLabelText("В корзину")).not.toBeInTheDocument();
  });

  it("shows em-dash placeholder when no offers", () => {
    const med = makeMedicine({ offers: [] });
    renderWithProviders(<MedicineCard medicine={med} />);
    // The add pill renders "—" when there's no price to advertise.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("hideCart mode shows «Нет офферов» when no offers", () => {
    const med = makeMedicine({ offers: [] });
    renderWithProviders(<MedicineCard medicine={med} hideCart />);
    expect(screen.getByText("Нет офферов")).toBeInTheDocument();
  });
});
