import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import { renderWithProviders } from "@/test/render";

function mockProfileFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/clients/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              client: {
                clientId: "c1",
                name: "Тест",
                phoneNumber: "900111222",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }
      if (url.includes("/api/orders/client-history")) {
        return Promise.resolve(
          new Response(JSON.stringify({ orders: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.includes("/api/basket")) {
        return Promise.resolve(
          new Response(JSON.stringify({ positions: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    })
  );
}

describe("ProfilePage", () => {
  it("guest: shows auth prompt", () => {
    renderWithProviders(<ProfilePage />);
    expect(screen.getByText("Требуется авторизация")).toBeInTheDocument();
  });

  it("authenticated: shows hero after load", async () => {
    mockProfileFetch();
    renderWithProviders(<ProfilePage />, {
      preloadedAuth: { token: "t", role: "Client", userId: "c1" },
    });
    expect(
      await screen.findByText(/Здравствуйте, Тест/)
    ).toBeInTheDocument();
  });

  it("authenticated: shows logout button", async () => {
    mockProfileFetch();
    renderWithProviders(<ProfilePage />, {
      preloadedAuth: { token: "t", role: "Client", userId: "c1" },
    });
    expect(
      await screen.findByText("Выйти из аккаунта")
    ).toBeInTheDocument();
  });
});
