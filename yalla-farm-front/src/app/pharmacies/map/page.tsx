"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { useAppSelector } from "@/shared/lib/redux";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Chip, EmptyState, Icon } from "@/shared/ui";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

export default function PharmaciesMapPage() {
  const token = useAppSelector((state) => state.auth.token);
  const selectedPharmacyId = useCheckoutDraftStore((state) => state.pharmacyId);
  const setDraft = useCheckoutDraftStore((state) => state.setDraft);
  const userCoords = useDeliveryAddressStore((s) => s.coords);

  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string>("");

  useEffect(() => {
    setIsLoading(true);
    getActivePharmacies(token ?? undefined)
      .then((data) => setPharmacies(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить аптеки."))
      .finally(() => setIsLoading(false));
  }, [token]);

  const mapMarkers = useMemo(
    () =>
      pharmacies
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          id: p.id,
          title: p.title,
          address: p.address,
          lat: p.latitude!,
          lng: p.longitude!,
          iconUrl: p.iconUrl,
        })),
    [pharmacies]
  );

  return (
    <AppShell hideFooter top={<TopBar title="Аптеки" backHref="back" />}>
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Map */}
        <section className="overflow-hidden rounded-3xl bg-surface-container-low shadow-card">
          <div className="h-[280px] sm:h-[360px] md:h-[420px]">
            <PharmacyMap
              className="h-full w-full"
              pharmacies={mapMarkers}
              userLocation={userCoords}
              onPharmacyClick={(id) => {
                setHighlightedId(id);
                const el = document.getElementById(`pharmacy-card-${id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => setHighlightedId(""), 2000);
              }}
            />
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-3xl bg-surface-container-low p-6 text-sm">Загружаем аптеки...</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {!isLoading && pharmacies.length === 0 ? (
          <EmptyState icon="pharmacy" title="Нет аптек" description="Аптеки временно недоступны" />
        ) : null}

        {/* Pharmacy list */}
        {pharmacies.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 font-display text-base font-extrabold">{pharmacies.length} аптек в Душанбе</h2>
            {pharmacies.map((pharmacy) => {
              const selected = selectedPharmacyId === pharmacy.id;
              const highlighted = highlightedId === pharmacy.id;
              return (
                <article
                  key={pharmacy.id}
                  id={`pharmacy-card-${pharmacy.id}`}
                  className={`flex items-center gap-3 rounded-3xl bg-surface-container-lowest p-4 shadow-card transition ${
                    highlighted ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-mint">
                    {pharmacy.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pharmacy.iconUrl.startsWith("http") ? pharmacy.iconUrl : `/api/pharmacies/icon/${pharmacy.id}/content`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon name="pharmacy" size={22} className="text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{pharmacy.title}</h3>
                    {pharmacy.address ? (
                      <p className="truncate text-xs text-on-surface-variant">{pharmacy.address}</p>
                    ) : null}
                    {selected ? <Chip tone="primary" asButton={false} size="sm" leftIcon="check">Выбрана</Chip> : null}
                  </div>
                  <Button
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setDraft({ pharmacyId: pharmacy.id })}
                  >
                    {selected ? "Выбрано" : "Выбрать"}
                  </Button>
                </article>
              );
            })}

            {selectedPharmacyId ? (
              <div className="pt-2">
                <Link href="/checkout">
                  <Button size="lg" fullWidth rightIcon="arrow-right">
                    Продолжить к оформлению
                  </Button>
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
