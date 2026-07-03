"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PharmaciesMapRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pharmacies?tab=map");
  }, [router]);

  return null;
}
