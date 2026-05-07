import { PayloadAction, createSlice } from "@reduxjs/toolkit";

type AuthState = {
  token: string | null;
  role: string | null;
  userId: string | null;
  pharmacyId: string | null;
  /** Becomes true after StoreProvider has read the persisted token (or
   *  confirmed there isn't one). Pages that gate on auth must wait for this
   *  flag before redirecting to /login — otherwise the very first render,
   *  where token is still null, kicks logged-in users out on every refresh. */
  hydrated: boolean;
};

const initialState: AuthState = {
  token: null,
  role: null,
  userId: null,
  pharmacyId: null,
  hydrated: false
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; role?: string | null; userId?: string | null; pharmacyId?: string | null }>
    ) => {
      state.token = action.payload.token;
      state.role = action.payload.role ?? state.role;
      state.userId = action.payload.userId ?? state.userId;
      state.pharmacyId = action.payload.pharmacyId ?? state.pharmacyId;
      state.hydrated = true;
    },
    clearCredentials: (state) => {
      state.token = null;
      state.role = null;
      state.userId = null;
      state.pharmacyId = null;
      state.hydrated = true;
    },
    markHydrated: (state) => {
      state.hydrated = true;
    }
  }
});

export const { setCredentials, clearCredentials, markHydrated } = authSlice.actions;
export const authReducer = authSlice.reducer;
