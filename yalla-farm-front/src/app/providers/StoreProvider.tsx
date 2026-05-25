"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store, type RootState } from "@/app/store";
import { setCredentials, markHydrated } from "@/features/auth/model/authSlice";
import { decodeJwt } from "@/shared/lib/jwt";
import { getStoredToken, setStoredToken } from "@/shared/lib/auth-storage";
import { stopSignalRConnection } from "@/shared/lib/signalr";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useCartStore } from "@/features/cart/model/cartStore";

function getRoleHome(role: string | null): string | null {
  if (role === "Admin") return "/workspace";
  if (role === "SuperAdmin") return "/superadmin";
  if (role === "Pharmacist") return "/pharmacist";
  return null;
}

function AuthSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-accent-dark" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-accent-dark animate-spin" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-lowest shadow-card">
            <Image src="/logo-icon.png" alt="Yalla" width={44} height={43} priority className="h-11 w-11 object-contain" />
          </div>
        </div>
        <Image src="/logo-text.png" alt="Yalla Pharm" width={145} height={71} priority className="h-7 w-auto object-contain" />
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const role = useSelector((s: RootState) => s.auth.role);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const pathname = usePathname();
  const roleHome = getRoleHome(role);
  const isResolvingStaffRoute = hydrated && roleHome !== null && !pathname.startsWith(roleHome);

  if (!hydrated || isResolvingStaffRoute) {
    return <AuthSplash />;
  }

  return <>{children}</>;
}

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
    const roleHome = getRoleHome(role);
    if (roleHome && !pathname.startsWith(roleHome)) {
      router.replace(roleHome);
    }
  }, [hydrated, role, pathname, router]);

  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthPersistenceBridge />
      <RoleBasedRedirect />
      <AuthGate>{children}</AuthGate>
    </Provider>
  );
}
