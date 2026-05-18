"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
        name: claims.name,
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

/** Once the auth state has hydrated from storage, send staff users
 *  (Admin / SuperAdmin / Pharmacist) straight to their management
 *  screen no matter where they landed — including the public home,
 *  catalog, cart, or login pages. Stays out of the way once they're
 *  already inside their workspace area so the redirect doesn't loop. */
function RoleBasedRedirect() {
  const role = useSelector((s: RootState) => s.auth.role);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !role) return;
    if (role === "Admin" && !pathname.startsWith("/workspace")) {
      router.replace("/workspace");
    } else if (role === "SuperAdmin" && !pathname.startsWith("/superadmin")) {
      router.replace("/superadmin");
    } else if (role === "Pharmacist" && !pathname.startsWith("/pharmacist")) {
      router.replace("/pharmacist");
    }
  }, [hydrated, role, pathname, router]);

  return null;
}

/** Kicks off the Yandex Maps SDK download in the background once the app
 *  is idle. By the time the user opens the address picker, the bundle is
 *  usually cached — the modal then mounts in under a frame instead of
 *  waiting on a fresh script + TLS handshake. Wrapped in requestIdleCallback
 *  so it doesn't compete with hydration / first paint on slow devices. */
function MapPrewarm() {
  useEffect(() => {
    const kick = () => {
      void import("@/shared/lib/map/yandex-loader").then((m) => m.loadYmaps()).catch(() => undefined);
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(kick, { timeout: 4000 });
    } else {
      setTimeout(kick, 1500);
    }
  }, []);
  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthPersistenceBridge />
      <RoleBasedRedirect />
      <MapPrewarm />
      {children}
    </Provider>
  );
}
