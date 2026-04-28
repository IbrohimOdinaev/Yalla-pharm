"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Icon } from "@/shared/ui";
import {
  getMyAddresses,
  deleteMyAddress,
  type ClientAddress,
} from "@/entities/client/api";
import { SavedAddressEditorModal } from "@/widgets/address/SavedAddressEditorModal";

type Props = {
  token: string;
};

export function SavedAddressesSection({ token }: Props) {
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClientAddress | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMyAddresses(token);
      setAddresses(list);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { reload(); }, [reload]);

  const named = addresses.filter((a) => a.title);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(a: ClientAddress) {
    setEditing(a);
    setEditorOpen(true);
  }
  async function onDelete(a: ClientAddress) {
    if (!confirm(`Удалить адрес «${a.title}»?`)) return;
    try {
      await deleteMyAddress(token, a.id);
      setAddresses((prev) => prev.filter((x) => x.id !== a.id));
    } catch { /* ignore */ }
  }
  function onSaved(saved: ClientAddress) {
    setAddresses((prev) => {
      const existing = prev.find((x) => x.id === saved.id);
      if (existing) return prev.map((x) => (x.id === saved.id ? saved : x));
      return [saved, ...prev];
    });
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold">Сохранённые адреса</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Сохранённые адреса появятся в выборе доставки при оформлении заказа
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Загрузка...</p>
      ) : named.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-low p-4 text-center">
          <p className="text-sm text-on-surface-variant">У вас пока нет сохранённых адресов</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {named.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="pin" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{a.title}</p>
                <p className="truncate text-xs text-on-surface-variant">{a.address}</p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(a)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition"
                aria-label="Изменить"
                title="Изменить"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onDelete(a)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-red-50 hover:text-red-500 transition"
                aria-label="Удалить"
                title="Удалить"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button size="md" fullWidth leftIcon="plus" variant="secondary" onClick={openCreate}>
        Добавить адрес
      </Button>

      <SavedAddressEditorModal
        open={editorOpen}
        token={token}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={onSaved}
      />
    </section>
  );
}
