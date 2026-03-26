import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { renderWithProviders } from "@/test/render";

describe("LoginPage", () => {
  it("renders login form", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByPlaceholderText("900123456")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
  });

  it("renders register link", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText("Зарегистрироваться")).toBeInTheDocument();
  });

  it("maps numeric role 1 to Admin in store", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ accessToken: "tok", role: 1, userId: "u1" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const user = userEvent.setup();
    const { store } = renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText("900123456"), "901010101");
    await user.type(screen.getByPlaceholderText("••••••••"), "admin111");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    // Wait for dispatch
    await new Promise((r) => setTimeout(r, 100));
    expect(store.getState().auth.role).toBe("Admin");
    expect(store.getState().auth.token).toBe("tok");
  });

  it("maps numeric role 0 to Client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ accessToken: "tok", role: 0, userId: "u1" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const user = userEvent.setup();
    const { store } = renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText("900123456"), "900000001");
    await user.type(screen.getByPlaceholderText("••••••••"), "pass1234");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await new Promise((r) => setTimeout(r, 100));
    expect(store.getState().auth.role).toBe("Client");
  });

  it("shows error on failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Invalid credentials",
            detail: "Неверный пароль",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText("900123456"), "900000001");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByText(/Неверный пароль/i)).toBeInTheDocument();
  });
});
