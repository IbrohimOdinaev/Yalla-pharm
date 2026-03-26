import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { renderWithProviders } from "@/test/render";

describe("HomePage", () => {
  it("renders search button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            page: 1,
            pageSize: 24,
            totalCount: 0,
            medicines: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<HomePage />);
    expect(screen.getByLabelText("Поиск")).toBeInTheDocument();
  });

  it("shows medicine cards after fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            page: 1,
            pageSize: 24,
            totalCount: 1,
            medicines: [
              {
                id: "m1",
                title: "TestMed",
                articul: "ART-1",
                images: [],
                offers: [
                  { pharmacyId: "p1", stockQuantity: 5, price: 10 },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    renderWithProviders(<HomePage />);
    expect(await screen.findByText("TestMed")).toBeInTheDocument();
  });
});
