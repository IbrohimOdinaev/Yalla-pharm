"use client";

import { useEffect, useRef } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState } from "@/app/store";
import { setCredentials, markHydrated } from "@/features/auth/model/authSlice";
import { decodeJwt } from "@/shared/lib/jwt";
import { getStoredToken, setStoredToken } from "@/shared/lib/auth-storage";
import { stopSignalRConnection } from "@/shared/lib/signalr";
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
      const claims = decodeJwt(fromStorage);
      dispatch(setCredentials({
        token: fromStorage,
        role: claims.role,
        userId: claims.userId,
        pharmacyId: claims.pharmacyId,
      }));
    } else {
      // No token at all — still mark hydrated so auth-gated pages stop
      // showing their loading state and can render the public version.
      dispatch(markHydrated());
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
    // Tear down SignalR on logout so no stale connection keeps retrying with
    // the old (now-invalid) access token and flooding the console with 401s.
    if (!token && prevTokenRef.current) {
      stopSignalRConnection().catch(() => undefined);
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
