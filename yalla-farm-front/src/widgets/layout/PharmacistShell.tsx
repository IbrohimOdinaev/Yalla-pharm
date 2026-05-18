"use client";

import { useEffect, type ReactNode } from "react";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { CurrentPrescriptionPill } from "@/widgets/pharmacist/CurrentPrescriptionPill";
import { PrescriptionPickerModal } from "@/widgets/pharmacist/PrescriptionPickerModal";
import { StaffShell } from "@/widgets/layout/StaffShell";

/**
 * Layout chrome for every Pharmacist page. StaffShell renders the shared
 * role sidebar; the active-prescription pill lives in that sidebar.
 *
 * Lazy-loads the persisted active id and per-prescription drafts on mount
 * so a refresh doesn't lose the in-progress checklist.
 */
export function PharmacistShell({ children }: { children: ReactNode }) {
  const loadActive = useActivePrescriptionStore((s) => s.load);
  const loadDrafts = usePrescriptionDraftStore((s) => s.load);

  useEffect(() => { loadActive(); loadDrafts(); }, [loadActive, loadDrafts]);

  return (
    <StaffShell
      title="Pharmacist"
      subtitle="Работа с рецептами"
      sideSlot={<CurrentPrescriptionPill />}
    >
      {children}
      <PrescriptionPickerModal />
      {/* StaffShell owns ProductModal. For Pharmacist role it adds selected
          medicines to the active prescription draft instead of buyer cart. */}
    </StaffShell>
  );
}
