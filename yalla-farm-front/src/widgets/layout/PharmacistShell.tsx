"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { CurrentPrescriptionPill } from "@/widgets/pharmacist/CurrentPrescriptionPill";
import { PrescriptionPickerModal } from "@/widgets/pharmacist/PrescriptionPickerModal";
import { BottomNav } from "@/widgets/layout/BottomNav";
import { Icon } from "@/shared/ui";

/**
 * Layout chrome for every Pharmacist page. Renders:
 *   • a sticky header with the active-prescription pill + logout
 *   • the prescription-picker modal (toggled from the pill)
 *   • the page body
 *   • the BottomNav (Pharmacist variant: Очередь / Корзина / Каталог)
 *
 * Lazy-loads the persisted active id and per-prescription drafts on mount
 * so a refresh doesn't lose the in-progress checklist.
 */
export function PharmacistShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.role);

  const loadActive = useActivePrescriptionStore((s) => s.load);
  const loadDrafts = usePrescriptionDraftStore((s) => s.load);

  useEffect(() => { loadActive(); loadDrafts(); }, [loadActive, loadDrafts]);

  function onLogout() {
    dispatch(clearCredentials());
    router.replace("/login/admin");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Yalla" className="h-8 w-8 flex-shrink-0" />

          <CurrentPrescriptionPill />

          <span className="flex-1" />

          {role === "Pharmacist" ? (
            <button
              type="button"
              onClick={onLogout}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary-soft"
              aria-label="Выйти"
            >
              <Icon name="logout" size={14} />
              <span className="hidden xs:inline">Выйти</span>
            </button>
          ) : null}
        </div>
        <div className="hair-divider" />
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-24 pt-4 sm:px-6 lg:px-8">
        {children}
      </main>

      <BottomNav />
      <PrescriptionPickerModal />
    </div>
  );
}
