import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";

describe("register page integration", () => {
  it("shows backend validation errors on failed sms registration request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Request validation failed.",
            errors: {
              PhoneNumber: ["Phone number has invalid format."]
            },
            reason: "validation_error"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Имя"), "Test User");
    await user.type(screen.getByLabelText("Телефон"), "911111111");
    await user.type(screen.getByLabelText("Пароль"), "Password123");

    await user.click(screen.getByRole("button", { name: "Получить код" }));

    expect(await screen.findByText(/PhoneNumber: Phone number has invalid format\./i)).toBeInTheDocument();
  });
});
