"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { useAppSelector } from "@/shared/lib/redux";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";

// Wraps the inner component — `useSearchParams` requires a Suspense boundary
// when rendered inside pages that are otherwise statically generated.
export function GlobalTopBar() {
  return (
    <Suspense fallback={<GlobalTopBarFallback />}>
      <GlobalTopBarInner />
    </Suspense>
  );
}

function GlobalTopBarFallback() {
  // Render a non-interactive version without useSearchParams so SSR/static
  // generation stays happy. The Suspense swap is invisible in practice.
  return (
    <TopBar
      title="Yalla Pharm"
      homeMode
      addressText=""
      addressTitle=""
    />
  );
}

function GlobalTopBarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAppSelector((s) => s.auth.role);
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const deliveryAddressTitle = useDeliveryAddressStore((s) => s.title);
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  // The page's own on-page search UI is active while `?search=…` is in the URL.
  // Hide the top-bar search pill so only one search input is visible at a time.
  const hideSearch = searchParams.has("search");

  // Hide the prescription CTA for staff — they don't shop. Same condition the
  // home-page banner uses, so the in-header pill and the page banner share
  // visibility rules and never both vanish for a real client.
  const showPrescriptionCta = role !== "Admin" && role !== "SuperAdmin";

  return (
    <>
      <TopBar
        title="Аптека Душанбе"
        homeMode
        hideSearch={hideSearch}
        showPrescriptionCta={showPrescriptionCta}
        onLogoClick={() => { window.location.href = "/"; }}
        onSearchClick={() => router.push("/?search=")}
        addressText={deliveryAddress}
        addressTitle={deliveryAddressTitle ?? ""}
        onAddressClick={() => setShowAddressModal(true)}
      />
      <AddressPickerModal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
    </>
  );
}
