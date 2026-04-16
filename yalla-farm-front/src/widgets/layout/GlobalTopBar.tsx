"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import { PharmacyPickerModal } from "@/widgets/pharmacy/PharmacyPickerModal";

export function GlobalTopBar() {
  const router = useRouter();
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  const loadPharmacy = usePharmacyStore((s) => s.load);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);

  useEffect(() => { loadPharmacy(); }, [loadPharmacy]);

  return (
    <>
      <TopBar
        title="Аптека Душанбе"
        homeMode
        onLogoClick={() => { window.location.href = "/"; }}
        onSearchClick={() => router.push("/?search=")}
        addressText={deliveryAddress}
        onAddressClick={() => setShowAddressModal(true)}
        pharmacyName={selectedPharmacy?.title}
        pharmacyIconUrl={selectedPharmacy?.iconUrl}
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
