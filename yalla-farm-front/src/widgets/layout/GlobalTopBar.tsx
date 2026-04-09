"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { TopBar } from "@/widgets/layout/TopBar";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";

export function GlobalTopBar() {
  const router = useRouter();
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const [showAddressModal, setShowAddressModal] = useState(false);

  return (
    <>
      <TopBar
        title="Аптека Душанбе"
        homeMode
        onLogoClick={() => { window.location.href = "/"; }}
        onSearchClick={() => router.push("/?search=")}
        addressText={deliveryAddress}
        onAddressClick={() => setShowAddressModal(true)}
      />
      <AddressPickerModal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
    </>
  );
}
