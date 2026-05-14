import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { renderWithProviders } from "@/test/render";

// HomePage fetches several rails on mount (categories, multiple paginated
// medicine lists). A blanket fetch stub returning an empty page lets the
// component render without throwing; we then assert the static chrome of
// the page rather than rely on a specific rail surfacing the seed item,
// which depends on the matched category for a recommendation.
function stubEmptyFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ page: 1, pageSize: 24, totalCount: 0, medicines: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

describe("HomePage", () => {
  it("renders the search pill placeholder", async () => {
    stubEmptyFetch();
    renderWithProviders(<HomePage />);
    // The search affordance is a button with the placeholder text rather
    // than an aria-labelled input.
    await waitFor(() => {
      expect(
        screen.getAllByText(/Найти лекарства/).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the Yalla Pharm logo word-mark", async () => {
    stubEmptyFetch();
    renderWithProviders(<HomePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Yalla Pharm").length).toBeGreaterThanOrEqual(1);
    });
  });
});
