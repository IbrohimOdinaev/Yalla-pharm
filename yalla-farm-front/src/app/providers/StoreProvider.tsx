"use client";

import { useEffect, useRef } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState } from "@/app/store";
import { setCredentials } from "@/features/auth/model/authSlice";
import { getStoredToken, setStoredToken } from "@/shared/lib/auth-storage";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCartStore } from "@/features/cart/model/cartStore";

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
      // Decode JWT to extract role and userId
      let role: string | undefined;
      let userId: string | undefined;
      try {
        const payload = JSON.parse(atob(fromStorage.split(".")[1]));
        const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };
        const rawRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
        role = typeof rawRole === "number" ? ROLE_MAP[rawRole] : String(rawRole || "");
        userId = payload.sub || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || undefined;
      } catch { /* ignore decode errors */ }
      dispatch(setCredentials({ token: fromStorage, role, userId }));
    }
  }, [dispatch]);

  const loadServerCart = useCartStore((state) => state.loadBasket);

  useEffect(() => {
    setStoredToken(token);

    // merge guest cart and load server cart when user just logged in
    if (token && !prevTokenRef.current) {
      guestMerge(token).catch(() => undefined);
    }
    // Load server cart whenever token is available
    if (token) {
      loadServerCart(token).catch(() => undefined);
    }
    prevTokenRef.current = token;
  }, [token, guestMerge, loadServerCart]);

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
