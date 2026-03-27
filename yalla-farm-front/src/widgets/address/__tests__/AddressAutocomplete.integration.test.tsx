import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { renderWithProviders } from "@/test/render";

describe("AddressAutocomplete", () => {
  it("renders input with placeholder", () => {
    renderWithProviders(<AddressAutocomplete value="" onChange={vi.fn()} placeholder="Адрес..." />);
    expect(screen.getByPlaceholderText("Адрес...")).toBeInTheDocument();
  });

  it("renders with value", () => {
    renderWithProviders(<AddressAutocomplete value="ул. Рудаки" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("ул. Рудаки")).toBeInTheDocument();
  });
});
