"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getMyPrescriptions,
  markPrescriptionPaid,
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AuthedImage, Button, Chip } from "@/shared/ui";

// Slice-1 detail page — read-only view of what the client submitted plus
// (eventually) the pharmacist's checklist. For now items are usually empty
// because the pharmacist workflow is shipped later; we keep this page tiny
// and unsurprising.
export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const [all, setAll] = useState<ApiPrescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login?next=/prescriptions"); return; }
    if (role && role !== "Client") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyPrescriptions(token)
      .then((data) => { if (!cancelled) setAll(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить рецепт.");
      });
    return () => { cancelled = true; };
  }, [token]);

  const prescription = useMemo(
    () => all?.find((p) => p.prescriptionId === id) ?? null,
    [all, id]
  );

  return (
    <AppShell top={<TopBar title="Рецепт" backHref="back" />}>
      <div className="mx-auto max-w-3xl space-y-4">
        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">
            {error}
          </div>
        ) : null}

        {!all ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Загружаем…
          </div>
        ) : !prescription ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Рецепт не найден.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="tertiary" asButton={false} size="sm">
                {PRESCRIPTION_STATUS_LABEL_RU[prescription.status] ?? prescription.status}
              </Chip>
              <span className="text-xs text-on-surface-variant">
                {new Date(prescription.createdAtUtc).toLocaleString("ru-RU")}
              </span>
            </div>

            {/* Submitted = client uploaded but hasn't confirmed payment yet.
                We surface a brief "I paid" CTA so they can flip the
                status to AwaitingConfirmation after returning from DC. */}
            {prescription.status === "Submitted" ? (
              <section className="space-y-3 rounded-2xl bg-accent-soft p-4">
                <p className="text-sm font-bold text-on-surface">Ожидаем подтверждения оплаты</p>
                <p className="text-xs text-on-surface-variant">
                  Если вы уже оплатили 3 TJS на странице DushanbeCity — нажмите кнопку ниже.
                  После этого SuperAdmin сверит платёж и заявка уйдёт фармацевту.
                </p>
                <Button
                  size="md"
                  loading={marking}
                  onClick={async () => {
                    if (!token) return;
                    setMarking(true);
                    setError(null);
                    try {
                      await markPrescriptionPaid(token, id);
                      const reloaded = await getMyPrescriptions(token);
                      setAll(reloaded);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Не удалось отметить оплату.");
                    } finally {
                      setMarking(false);
                    }
                  }}
                >
                  Я оплатил
                </Button>
              </section>
            ) : null}

            <section className="space-y-2">
              <h2 className="font-display text-base font-extrabold">Фото</h2>
              <div className="grid grid-cols-2 gap-3">
                {prescription.images.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container shadow-card"
                  >
                    <AuthedImage src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <p className="text-sm">
                <span className="font-semibold text-on-surface-variant">Возраст пациента: </span>
                <span className="font-bold">{prescription.patientAge}</span>
              </p>
              {prescription.clientComment ? (
                <p className="text-sm">
                  <span className="font-semibold text-on-surface-variant">Комментарий: </span>
                  <span>{prescription.clientComment}</span>
                </p>
              ) : null}
            </section>

            {prescription.pharmacistOverallComment ? (
              <section className="rounded-2xl bg-primary-soft p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Фармацевт</p>
                <p className="mt-1 text-sm text-on-surface">{prescription.pharmacistOverallComment}</p>
              </section>
            ) : null}

            {prescription.items.length > 0 ? (
              <section className="space-y-2">
                <h2 className="font-display text-base font-extrabold">Назначение</h2>
                <ul className="space-y-2">
                  {prescription.items.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-2xl bg-surface-container-lowest p-3 shadow-card"
                    >
                      <p className="text-sm font-bold">
                        {it.manualMedicineName ?? it.medicineId ?? "—"}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Количество: {it.quantity}
                      </p>
                      {it.pharmacistComment ? (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {it.pharmacistComment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                Фармацевт ещё не прислал чек-лист. Как только расшифровка будет
                готова — она появится здесь.
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
