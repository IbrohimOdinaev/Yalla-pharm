"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Deep-link fallback: redirect to /workspace with ?orderId=X&tab=orders so the
 * list page auto-opens the modal with the pharmacy kanban visible behind it.
 */
export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = String(params?.id || "");

  useEffect(() => {
    router.replace(orderId ? `/workspace?orderId=${encodeURIComponent(orderId)}#orders` : "/workspace#orders");
  }, [orderId, router]);

  return null;
}
