import { describe, expect, it } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import {
  authReducer,
  setCredentials,
  clearCredentials,
} from "@/features/auth/model/authSlice";

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

describe("authSlice", () => {
  it("starts with null values", () => {
    const store = createTestStore();
    const state = store.getState().auth;
    expect(state.token).toBeNull();
    expect(state.role).toBeNull();
    expect(state.userId).toBeNull();
  });

  it("setCredentials sets token", () => {
    const store = createTestStore();
    store.dispatch(setCredentials({ token: "abc123" }));
    expect(store.getState().auth.token).toBe("abc123");
  });

  it("setCredentials sets role and userId", () => {
    const store = createTestStore();
    store.dispatch(
      setCredentials({ token: "t", role: "Admin", userId: "u1" }),
    );
    expect(store.getState().auth.role).toBe("Admin");
    expect(store.getState().auth.userId).toBe("u1");
  });

  it("clearCredentials resets all", () => {
    const store = createTestStore();
    store.dispatch(
      setCredentials({ token: "t", role: "Client", userId: "u1" }),
    );
    store.dispatch(clearCredentials());
    const state = store.getState().auth;
    expect(state.token).toBeNull();
    expect(state.role).toBeNull();
    expect(state.userId).toBeNull();
  });
});
