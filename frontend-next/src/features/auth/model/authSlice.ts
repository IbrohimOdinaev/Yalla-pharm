import { PayloadAction, createSlice } from "@reduxjs/toolkit";

type AuthState = {
  token: string | null;
  role: string | null;
  userId: string | null;
};

const initialState: AuthState = {
  token: null,
  role: null,
  userId: null
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; role?: string | null; userId?: string | null }>
    ) => {
      state.token = action.payload.token;
      state.role = action.payload.role ?? state.role;
      state.userId = action.payload.userId ?? state.userId;
    },
    clearCredentials: (state) => {
      state.token = null;
      state.role = null;
      state.userId = null;
    }
  }
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export const authReducer = authSlice.reducer;
