import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "@/features/auth/model/authSlice";

type AuthState = {
  token: string | null;
  role: string | null;
  userId: string | null;
  pharmacyId: string | null;
};

type RenderWithProvidersOptions = RenderOptions & {
  preloadedAuth?: Partial<AuthState>;
};

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedAuth, ...options }: RenderWithProvidersOptions = {}
) {
  const testStore = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        token: preloadedAuth?.token ?? null,
        role: preloadedAuth?.role ?? null,
        userId: preloadedAuth?.userId ?? null,
        pharmacyId: preloadedAuth?.pharmacyId ?? null,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={testStore}>{children}</Provider>;
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}
