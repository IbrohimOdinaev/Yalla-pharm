"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthedImage, Button, Icon } from "@/shared/ui";
import { useAppSelector } from "@/shared/lib/redux";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import {
  createManualLookupRequest,
  getManualLookupById,
  resolveManualLookupImageUrl,
  type ApiManualLookupRequest,
} from "@/entities/manual-lookup/api";

type ManualLookupPanelProps = {
  prescriptionId: string;
  manualMedicineName: string;
  /** Set when a request has already been created for this item. The
   *  panel switches to "responses" mode and polls/listens for new
   *  pharmacy answers via SignalR. */
  lookupRequestId: string | null;
  /** Callback when the pharmacist creates a request from this panel —
   *  parent component is expected to write the new id back into draft
   *  state so the panel can swap to responses mode. */
  onRequestCreated: (requestId: string) => void;
};

/**
 * Inline panel for a single manual checklist item. Two modes:
 *
 *  • No lookup yet: a single "Запросить у других аптек" button + an
 *    optional comment input. Triggers POST /api/manual-lookups.
 *  • Lookup attached: shows the request status + every pharmacy's
 *    response (price, qty, optional photo, comment). Hot-reloads on
 *    `ManualLookupResponseAdded` so admin updates show up in seconds.
 */
export function ManualLookupPanel({
  prescriptionId,
  manualMedicineName,
  lookupRequestId,
  onRequestCreated,
}: ManualLookupPanelProps) {
  const token = useAppSelector((s) => s.auth.token);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ApiManualLookupRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !lookupRequestId) return;
    setLoading(true);
    try {
      const fresh = await getManualLookupById(token, lookupRequestId);
      setRequest(fresh);
    } catch {
      // silent; the SignalR refresh path will retry shortly anyway
    } finally {
      setLoading(false);
    }
  }, [token, lookupRequestId]);

  useEffect(() => {
    if (lookupRequestId) reload();
    else setRequest(null);
  }, [lookupRequestId, reload]);

  // Refetch on any new response targeted at this exact request — the
  // server broadcasts to the pharmacist group, but a single hub event
  // fans out to all open panels so we filter by id here.
  useSignalREvent(
    "ManualLookupResponseAdded",
    (...args: unknown[]) => {
      const [payload] = args;
      const incoming = payload as { requestId?: string } | undefined;
      if (!lookupRequestId || incoming?.requestId !== lookupRequestId) return;
      reload();
    },
    token,
  );

  async function onCreate() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createManualLookupRequest(token, {
        prescriptionId,
        manualMedicineName,
        requestComment: comment.trim() || null,
      });
      onRequestCreated(created.id);
      setRequest(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать запрос.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!lookupRequestId) {
    return (
      <div className="mt-2 rounded-xl bg-surface-container-low p-3 text-xs">
        <p className="font-semibold text-on-surface-variant">
          Нет в каталоге. Можно попросить другие аптеки физически найти препарат.
        </p>
        <input
          type="text"
          placeholder="Уточнение для аптек (дозировка, форма…)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          className="stitch-input mt-2 w-full text-xs"
        />
        {error ? <p className="mt-1 text-secondary">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={submitting} onClick={onCreate}>
            <Icon name="search" size={14} className="mr-1" />
            Запросить у других аптек
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-surface-container-low p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          {request?.status === "Closed" ? "Запрос закрыт" : "Опрос аптек"}
          {request?.responses?.length !== undefined ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              ответов: {request.responses.length}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="text-[10px] font-bold text-on-surface-variant hover:text-primary disabled:opacity-50"
          aria-label="Обновить"
          title="Обновить"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>
      {request?.requestComment ? (
        <p className="mt-1 text-on-surface-variant">Уточнение: {request.requestComment}</p>
      ) : null}
      {request && request.responses.length === 0 ? (
        <p className="mt-2 text-on-surface-variant">
          Пока ни одна аптека не ответила. Ответы появятся здесь автоматически.
        </p>
      ) : null}
      {request && request.responses.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {request.responses.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-lg bg-surface-container-lowest p-2"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-surface-container">
                {r.imageUrl ? (
                  <AuthedImage
                    src={resolveManualLookupImageUrl(r.imageUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
                    <Icon name="pharmacy" size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-bold">{r.fullName}</p>
                <p className="text-on-surface-variant">
                  Аптека: {r.respondingPharmacyTitle ?? r.respondingPharmacyId.slice(0, 8)}
                </p>
                <p className="font-bold">
                  {r.price.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} TJS
                  <span className="ml-2 font-normal text-on-surface-variant">
                    · в наличии: {r.quantity}
                  </span>
                </p>
                {r.responseComment ? (
                  <p className="mt-0.5 line-clamp-2 text-on-surface-variant">{r.responseComment}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
