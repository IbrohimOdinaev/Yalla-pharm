"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import { PharmacyPickerModal } from "@/widgets/pharmacy/PharmacyPickerModal";

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
      title="Yalla Farm"
      homeMode
      addressText=""
      pharmacyName=""
      pharmacyIconUrl={null}
    />
  );
}

function GlobalTopBarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  const loadPharmacy = usePharmacyStore((s) => s.load);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);

  useEffect(() => { loadPharmacy(); }, [loadPharmacy]);
  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  // The page's own on-page search UI is active while `?search=…` is in the URL.
  // Hide the top-bar search pill so only one search input is visible at a time.
  const hideSearch = searchParams.has("search");

  return (
    <>
      <TopBar
        title="Аптека Душанбе"
        homeMode
        hideSearch={hideSearch}
        onLogoClick={() => { window.location.href = "/"; }}
        onSearchClick={() => router.push("/?search=")}
        addressText={deliveryAddress}
        onAddressClick={() => setShowAddressModal(true)}
        pharmacyName={selectedPharmacy?.title}
        pharmacyIconUrl={selectedPharmacy?.iconUrl}
        pharmacyId={selectedPharmacy?.id}
        onPharmacyClick={() => setShowPharmacyModal(true)}
      />
      <AddressPickerModal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
      <PharmacyPickerModal
        open={showPharmacyModal}
        onClose={() => setShowPharmacyModal(false)}
      />
    </>
  );
}
