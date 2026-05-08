"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/shared/ui";

type ManualEntryModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; quantity: number; comment: string | null }) => void;
};

/**
 * Compact modal with the manual-entry form (medicine name + qty + optional
 * comment). Used in the pharmacist cart page so the always-on inline block
 * doesn't crowd the screen.
 */
export function ManualEntryModal({ open, onClose, onSubmit }: ManualEntryModalProps) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setName(""); setQty("1"); setComment("");
    }
  }, [open]);

  if (!open) return null;

  function submit() {
    const trimmed = name.trim();
    const qtyNum = Number(qty);
    if (!trimmed) return;
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return;
    onSubmit({ name: trimmed, quantity: qtyNum, comment: comment.trim() || null });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-surface-container-lowest p-5 shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold">Препарат не из каталога</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
            aria-label="Закрыть"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="text-xs text-on-surface-variant">
          Клиент увидит пометку «Нет в каталоге» и красный индикатор отсутствия офферов.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Название препарата"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="stitch-input sm:col-span-2"
            autoFocus
          />
          <input
            type="number"
            min={1}
            placeholder="Кол-во"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="stitch-input"
          />
        </div>
        <input
          type="text"
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="stitch-input w-full"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>Добавить</Button>
        </div>
      </div>
    </div>
  );
}
