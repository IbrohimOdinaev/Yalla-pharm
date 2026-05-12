"use client";

import { useEffect } from "react";
import {
  PRESCRIPTION_STATUS_LABEL_RU,
  PRESCRIPTION_TIER_LABEL_RU,
  resolvePrescriptionImageUrl,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { AuthedImage, Button, Icon } from "@/shared/ui";

type Props = {
  prescription: ApiPrescription | null;
  onClose: () => void;
};

/**
 * Read-only modal for the pharmacist's history view: shows everything
 * the pharmacist composed for this prescription (client, photos,
 * patient age, comments, full checklist with titles + qty), with no
 * editable controls. Used so the pharmacist can review past work
 * without re-entering the active-prescription draft pipeline.
 */
export function PrescriptionDetailsModal({ prescription, onClose }: Props) {
  // Body scroll lock + ESC to close — same UX rules as the product modal.
  useEffect(() => {
    if (!prescription) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [prescription, onClose]);

  if (!prescription) return null;

  const phone = prescription.clientPhoneNumber?.replace(/\D/g, "");
  const phoneDisplay = phone ? `+992${phone}` : null;
  const decodedAt = prescription.decodedAtUtc || prescription.updatedAtUtc || prescription.createdAtUtc;

  // Pair handling: an item that appears as another row's analog is hidden
  // from the flat list (it's rendered inside its pair-block instead),
  // matching the cart composer's grouping rules.
  const itemsById = new Map(prescription.items.map((i) => [i.id, i]));
  const analogIds = new Set(
    prescription.items.filter((i) => i.analogItemId).map((i) => i.analogItemId as string),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-t-3xl bg-surface-container-lowest p-5 shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                {PRESCRIPTION_STATUS_LABEL_RU[prescription.status] ?? prescription.status}
              </span>
              <span className="text-xs text-on-surface-variant">
                {new Date(decodedAt).toLocaleString("ru-RU")}
              </span>
              {prescription.preferenceTier ? (
                <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                  {PRESCRIPTION_TIER_LABEL_RU[prescription.preferenceTier] ?? prescription.preferenceTier}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 font-display text-base font-extrabold">
              {prescription.clientName?.trim() || "Без имени"}
              {phoneDisplay ? <span className="ml-2 font-normal text-on-surface-variant">{phoneDisplay}</span> : null}
              {prescription.clientTelegramUsername ? (
                <span className="ml-2 font-normal text-on-surface-variant">@{prescription.clientTelegramUsername}</span>
              ) : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
            aria-label="Закрыть"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Photos — small thumbs so even slow storage doesn't hold the
              modal open. AuthedImage downloads the original blob; size is
              capped by the rendered width. */}
          {prescription.images && prescription.images.length > 0 ? (
            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Фото рецепта</p>
              <div className="flex gap-2 overflow-x-auto">
                {prescription.images.map((img) => (
                  <div key={img.id} className="relative h-28 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface-container">
                    <AuthedImage
                      src={resolvePrescriptionImageUrl(img.url)}
                      alt=""
                      lazy
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-2 rounded-xl bg-surface-container-low p-3 text-xs sm:grid-cols-2">
            <div>
              <span className="font-semibold text-on-surface-variant">Возраст пациента: </span>
              <span className="font-bold">{prescription.patientAge}</span>
            </div>
            {prescription.clientComment ? (
              <div className="sm:col-span-2">
                <span className="font-semibold text-on-surface-variant">Комментарий клиента: </span>
                <span>{prescription.clientComment}</span>
              </div>
            ) : null}
          </section>

          {prescription.pharmacistOverallComment ? (
            <section className="rounded-xl bg-primary-soft p-3 text-xs">
              <p className="mb-1 font-bold uppercase tracking-wider text-primary">Общий комментарий фармацевта</p>
              <p className="text-on-surface">{prescription.pharmacistOverallComment}</p>
            </section>
          ) : null}

          {/* Checklist items — read-only. Title resolution mirrors the
              client-side prescription detail: catalog items use the
              title snapshot, manual ones use ManualMedicineName, the
              "Не смог расшифровать" verdict gets a literal label. */}
          <section>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Корзина рецепта
            </p>
            {prescription.items.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                Чек-лист пуст.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prescription.items
                  .filter((it) => !analogIds.has(it.id))
                  .map((it) => {
                    const analog = it.analogItemId ? itemsById.get(it.analogItemId) : undefined;
                    return (
                      <ItemRow
                        key={it.id}
                        title={resolveTitle(it)}
                        comment={it.pharmacistComment}
                        quantity={it.quantity}
                        isManual={!it.medicineId && it.kind !== "Undecoded"}
                        analog={analog ? {
                          title: resolveTitle(analog),
                          comment: analog.pharmacistComment,
                          quantity: analog.quantity,
                          isManual: !analog.medicineId && analog.kind !== "Undecoded",
                        } : null}
                      />
                    );
                  })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
}

function resolveTitle(it: ApiPrescription["items"][number]): string {
  if (it.kind === "Undecoded") return "Не смог расшифровать";
  if (it.manualMedicineName) return it.manualMedicineName;
  if (it.medicineTitle) return it.medicineTitle;
  if (it.medicineId) return "—";
  return "Без названия";
}

function ItemRow({
  title,
  comment,
  quantity,
  isManual,
  analog,
}: {
  title: string;
  comment?: string | null;
  quantity: number;
  isManual: boolean;
  analog: { title: string; comment?: string | null; quantity: number; isManual: boolean } | null;
}) {
  return (
    <li className={`rounded-lg p-2 text-xs ${analog ? "bg-primary-soft" : "bg-surface-container-low"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">
            {title}
            {isManual ? (
              <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-bold text-warning">
                Нет в каталоге
              </span>
            ) : null}
          </p>
          {comment ? (
            <p className="mt-0.5 text-on-surface-variant">{comment}</p>
          ) : null}
        </div>
        <span className="flex-shrink-0 font-bold text-on-surface-variant">×{quantity}</span>
      </div>

      {analog ? (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-surface-container-lowest p-1.5">
          <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary">
            Аналог
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">
              {analog.title}
              {analog.isManual ? (
                <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-bold text-warning">
                  Нет в каталоге
                </span>
              ) : null}
            </p>
            {analog.comment ? (
              <p className="mt-0.5 text-on-surface-variant">{analog.comment}</p>
            ) : null}
          </div>
          <span className="flex-shrink-0 font-bold text-on-surface-variant">×{analog.quantity}</span>
        </div>
      ) : null}
    </li>
  );
}
