"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getMyPrescriptions,
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
  type PrescriptionStatus,
} from "@/entities/prescription/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AuthedImage, Button, Chip, EmptyState, Icon } from "@/shared/ui";

// Visual style per status — keeps the list scannable.
const STATUS_TONE: Record<PrescriptionStatus, "primary" | "warning" | "success" | "danger" | "tertiary"> = {
  Submitted: "tertiary",
  AwaitingConfirmation: "warning",
  InQueue: "tertiary",
  InReview: "warning",
  Decoded: "success",
  OrderPlaced: "success",
  MovedToCart: "primary",
  Cancelled: "danger",
};

export default function MyPrescriptionsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const router = useRouter();

  const [prescriptions, setPrescriptions] = useState<ApiPrescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page is client-only — pharmacist / admin / guest all bounce.
  // Wait for auth state to hydrate from localStorage before deciding;
  // otherwise the very first render kicks logged-in users out on refresh.
  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login?next=/prescriptions");
      return;
    }
    if (role && role !== "Client") {
      router.replace("/");
    }
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getMyPrescriptions(token)
      .then((data) => { if (!cancelled) { setPrescriptions(data); setIsLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить рецепты.");
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <AppShell top={<TopBar title="Мои рецепты" backHref="back" />}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            Загрузите фото рецепта от врача — фармацевт расшифрует его и пришлёт готовый список лекарств.
          </p>
          <Link href="/prescriptions/new" className="flex-shrink-0">
            <Button size="md" leftIcon="plus">Новый</Button>
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Загружаем…
          </div>
        ) : prescriptions.length === 0 ? (
          <EmptyState
            icon="orders"
            title="Пока нет рецептов"
            description="Загрузите первое фото рецепта — расшифровка стоит 3 TJS."
            action={
              <Link href="/prescriptions/new">
                <Button size="md" rightIcon="arrow-right">Загрузить рецепт</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {prescriptions.map((p) => {
              const cover = p.images[0];
              const created = new Date(p.createdAtUtc).toLocaleString("ru-RU", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              });
              return (
                <li key={p.prescriptionId}>
                  <Link
                    href={`/prescriptions/${p.prescriptionId}`}
                    className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card transition hover:bg-surface-container xs:gap-4 xs:p-4"
                  >
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container xs:h-16 xs:w-16 xs:rounded-2xl">
                      <AuthedImage
                        src={cover?.url}
                        alt=""
                        className="h-full w-full object-cover"
                        fallback={
                          <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
                            <Icon name="orders" size={20} />
                          </div>
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Chip tone={STATUS_TONE[p.status] ?? "tertiary"} asButton={false} size="sm">
                          {PRESCRIPTION_STATUS_LABEL_RU[p.status] ?? p.status}
                        </Chip>
                        <span className="text-[11px] text-on-surface-variant">{created}</span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-on-surface">
                        Возраст пациента: {p.patientAge}
                      </p>
                      {p.clientComment ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">
                          {p.clientComment}
                        </p>
                      ) : null}
                    </div>
                    <Icon name="chevron-right" size={16} className="flex-shrink-0 text-on-surface-variant/60" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
