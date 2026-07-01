"use client";

import { useEffect } from "react";
import {
  PRESCRIPTION_TIER_LABEL_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { Button, Icon } from "@/shared/ui";
import { useBodyScrollLock } from "@/shared/lib/useBodyScrollLock";

type Props = {
  prescription: ApiPrescription | null;
  onClose: () => void;
};

export function PrescriptionClientInfoModal({ prescription, onClose }: Props) {
  useBodyScrollLock(Boolean(prescription));

  useEffect(() => {
    if (!prescription) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [prescription, onClose]);

  if (!prescription) return null;

  const phone = formatPhone(prescription.clientPhoneNumber);
  const telegramUsername = prescription.clientTelegramUsername
    ? `@${prescription.clientTelegramUsername.replace(/^@/, "")}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-on-surface/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-surface-container-lowest p-5 pb-safe-5 shadow-float sm:rounded-3xl sm:pb-5"
        role="dialog"
        aria-modal="true"
        aria-label="Информация о клиенте"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Клиент рецепта</p>
            <h2 className="mt-1 truncate font-display text-lg font-extrabold text-on-surface">
              {prescription.clientName?.trim() || "Имя не указано"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition active:scale-95 hover:bg-surface-container"
            aria-label="Закрыть"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          <section className="grid gap-2 sm:grid-cols-2">
            <InfoCell label="Имя" value={prescription.clientName?.trim() || "Не указано"} />
            <InfoCell label="Телефон" value={phone || "Не указан"} href={phone ? `tel:${phone}` : undefined} />
            <InfoCell label="Telegram" value={telegramUsername || "Не указан"} />
            <InfoCell
              label="Telegram ID"
              value={prescription.clientTelegramId != null ? String(prescription.clientTelegramId) : "Не указан"}
            />
            <InfoCell label="Client ID" value={prescription.clientId || "Не указан"} mono />
            <InfoCell label="Возраст пациента" value={`${prescription.patientAge}`} />
            <InfoCell
              label="Предпочтение"
              value={prescription.preferenceTier ? PRESCRIPTION_TIER_LABEL_RU[prescription.preferenceTier] : "Не указано"}
            />
            <InfoCell label="Создан" value={formatDate(prescription.createdAtUtc)} />
          </section>

          {prescription.clientContacts ? (
            <InfoBlock label="Контакты для связи" value={prescription.clientContacts} />
          ) : null}

          {prescription.clientComment ? (
            <InfoBlock label="Комментарий клиента" value={prescription.clientComment} />
          ) : null}

          <section className="rounded-2xl bg-surface-container-low p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Связанные ID</p>
            <div className="mt-2 space-y-2 text-xs">
              {prescription.publicId ? <IdRow label="Номер рецепта" value={`№${prescription.publicId}`} /> : null}
              <IdRow label="Рецепт" value={prescription.prescriptionId} />
              <IdRow label="Платёж" value={prescription.paymentIntentId} />
              <IdRow label="Заказ" value={prescription.orderId} />
            </div>
          </section>
        </div>

        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  href,
  mono = false,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  const className = `mt-1 break-words text-sm font-bold text-on-surface ${mono ? "font-mono text-xs" : ""}`;
  return (
    <div className="rounded-2xl bg-surface-container-low p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">{label}</p>
      {href ? (
        <a href={href} className={`${className} block text-primary hover:underline`}>
          {value}
        </a>
      ) : (
        <p className={className}>{value}</p>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl bg-surface-container-low p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-on-surface">{value}</p>
    </section>
  );
}

function IdRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="font-semibold text-on-surface-variant">{label}</p>
      <p className="break-all font-mono text-[11px] text-on-surface">{value || "Не указан"}</p>
    </div>
  );
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("992") ? `+${digits}` : `+992${digits}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Не указано";
  return new Date(value).toLocaleString("ru-RU");
}
