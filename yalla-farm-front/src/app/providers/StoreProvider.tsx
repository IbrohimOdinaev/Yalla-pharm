"use client";

import { useEffect, useRef } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState } from "@/app/store";
import { setCredentials } from "@/features/auth/model/authSlice";
import { getStoredToken, setStoredToken } from "@/shared/lib/auth-storage";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";

function AuthPersistenceBridge() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const prevTokenRef = useRef<string | null>(null);
  const guestMerge = useGuestCartStore((state) => state.mergeIntoServer);
  const guestLoad = useGuestCartStore((state) => state.load);

  useEffect(() => {
    guestLoad();
  }, [guestLoad]);

  useEffect(() => {
    const fromStorage = getStoredToken();
    if (fromStorage) {
      dispatch(setCredentials({ token: fromStorage }));
    }
  }, [dispatch]);

  useEffect(() => {
    setStoredToken(token);

    // merge guest cart when user just logged in
    if (token && !prevTokenRef.current) {
      guestMerge(token).catch(() => undefined);
    }
    prevTokenRef.current = token;
  }, [token, guestMerge]);

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
