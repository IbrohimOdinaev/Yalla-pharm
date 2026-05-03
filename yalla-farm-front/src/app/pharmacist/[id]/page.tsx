"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";

/**
 * Legacy entry point — every link or shortcut to a specific prescription
 * now sets it as the active one and redirects to /pharmacist/cart, where
 * the unified composer lives. Kept as a route so old URLs / external
 * links keep working.
 */
export default function PharmacistPrescriptionRedirect() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const setActiveId = useActivePrescriptionStore((s) => s.setActiveId);
  const router = useRouter();

  useEffect(() => {
    if (id) setActiveId(id);
    router.replace("/pharmacist/cart");
  }, [id, setActiveId, router]);

  return null;
}
