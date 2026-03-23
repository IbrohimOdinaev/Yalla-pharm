"use client";

import { useEffect } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState } from "@/app/store";
import { setCredentials } from "@/features/auth/model/authSlice";
import { getStoredToken, setStoredToken } from "@/shared/lib/auth-storage";

function AuthPersistenceBridge() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    const fromStorage = getStoredToken();
    if (fromStorage) {
      dispatch(setCredentials({ token: fromStorage }));
    }
  }, [dispatch]);

  useEffect(() => {
    setStoredToken(token);
  }, [token]);

  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthPersistenceBridge />
      {children}
    </Provider>
  );
}
