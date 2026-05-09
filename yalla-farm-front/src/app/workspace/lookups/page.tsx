"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon } from "@/shared/ui";
import {
  getActiveManualLookups,
  getManualLookupHistory,
  getMyManualLookupResponse,
  respondToManualLookup,
} from "@/entities/manual-lookup/admin-api";
import {
  resolveManualLookupImageUrl,
  type ApiManualLookupRequest,
  type ApiManualLookupResponse,
} from "@/entities/manual-lookup/api";

type AdminTab = "active" | "history";

/**
 * Admin workspace tab for manual-lookup requests. Two sub-tabs:
 *
 *  • Active — every Open request across all pharmacists. Click "Ответить"
 *    on a row to expand the upsert form (full name, price, qty, optional
 *    photo, comment). Idempotent — submitting again updates the same row.
 *  • History — Closed requests ordered newest first.
 *
 * Live-listens to ManualLookupRequestCreated/Closed so the lists self-
 * update without polling.
 */
export default function AdminLookupsPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const [tab, setTab] = useState<AdminTab>("active");
  const [active, setActive] = useState<ApiManualLookupRequest[]>([]);
  const [history, setHistory] = useState<ApiManualLookupRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/workspace/lookups"); return; }
    if (role && role !== "Admin") router.replace("/");
  }, [hydrated, token, role, router]);

  const loadActive = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try { setActive(await getActiveManualLookups(token)); }
    catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить."); }
    finally { setLoading(false); }
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const r = await getManualLookupHistory(token, 1, 100);
      setHistory(r.requests);
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (tab === "active") loadActive();
    else loadHistory();
  }, [tab, loadActive, loadHistory]);

  // Live: a new request appears → prepend it; a request closes → drop
  // from active and re-pull history if that tab is currently visible.
  useSignalREvent("ManualLookupRequestCreated", () => {
    if (tab === "active") loadActive();
  }, token);
  useSignalREvent("ManualLookupRequestClosed", () => {
    if (tab === "active") loadActive();
    else loadHistory();
  }, token);
  useSignalREvent("ManualLookupResponseAdded", () => {
    // Either tab could include the affected request; cheap refresh
    if (tab === "active") loadActive();
    else loadHistory();
  }, token);

  const list = tab === "active" ? active : history;

  return (
    <AppShell>
      <TopBar title="Запросы на ручной поиск" />
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === "active" ? "primary" : "secondary"}
            onClick={() => setTab("active")}
          >
            Активные
          </Button>
          <Button
            size="sm"
            variant={tab === "history" ? "primary" : "secondary"}
            onClick={() => setTab("history")}
          >
            История
          </Button>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
        ) : null}

        {!loading && list.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            {tab === "active" ? "Нет активных запросов." : "История пуста."}
          </div>
        ) : null}

        <ul className="space-y-2">
          {list.map((req) => {
            const isOpen = openRequestId === req.id;
            return (
              <li key={req.id} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{req.manualMedicineName}</p>
                    <p className="text-xs text-on-surface-variant">
                      Фармацевт: {req.requestedByPharmacistName ?? req.requestedByPharmacistId.slice(0, 8)}
                      <span className="ml-2">{new Date(req.createdAtUtc).toLocaleString("ru-RU")}</span>
                    </p>
                    {req.requestComment ? (
                      <p className="mt-1 text-xs">
                        <span className="font-semibold text-on-surface-variant">Уточнение: </span>
                        {req.requestComment}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      Ответов: {req.responses.length}
                      {req.status === "Closed" && req.closedAtUtc
                        ? ` · закрыт ${new Date(req.closedAtUtc).toLocaleString("ru-RU")}`
                        : null}
                    </p>
                  </div>
                  {tab === "active" ? (
                    <Button
                      size="sm"
                      variant={isOpen ? "secondary" : "primary"}
                      onClick={() => setOpenRequestId(isOpen ? null : req.id)}
                    >
                      {isOpen ? "Свернуть" : "Ответить"}
                    </Button>
                  ) : null}
                </div>

                {isOpen && tab === "active" ? (
                  <RespondInline
                    requestId={req.id}
                    onSubmitted={() => {
                      setOpenRequestId(null);
                      loadActive();
                    }}
                  />
                ) : null}

                {tab === "history" && req.responses.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
                    {req.responses.map((r) => (
                      <li key={r.id} className="rounded-md bg-surface-container-low p-2">
                        <span className="font-bold text-on-surface">
                          {r.respondingPharmacyTitle ?? r.respondingPharmacyId.slice(0, 8)}
                        </span>
                        : {r.fullName} —{" "}
                        {r.price.toLocaleString("ru-RU")} TJS, qty: {r.quantity}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}

/* Inline upsert form. Loads any existing response on open so the admin
   sees their previous values, can edit, attach a photo, or clear the
   image. POSTs as multipart and tells the parent to refresh on success. */
function RespondInline({
  requestId,
  onSubmitted,
}: {
  requestId: string;
  onSubmitted: () => void;
}) {
  const token = useAppSelector((s) => s.auth.token);
  const [existing, setExisting] = useState<ApiManualLookupResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyManualLookupResponse(token, requestId).then((r) => {
      if (cancelled) return;
      setExisting(r);
      if (r) {
        setFullName(r.fullName);
        setPrice(String(r.price));
        setQuantity(String(r.quantity));
        setComment(r.responseComment ?? "");
      }
    });
    return () => { cancelled = true; };
  }, [token, requestId]);

  async function submit() {
    if (!token) return;
    const priceNum = Number(price);
    const qtyNum = Number(quantity);
    if (!fullName.trim()) { setError("Укажите название."); return; }
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setError("Цена должна быть > 0."); return; }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) { setError("Кол-во должно быть > 0."); return; }
    setSubmitting(true); setError(null);
    try {
      await respondToManualLookup(token, requestId, {
        fullName: fullName.trim(),
        price: priceNum,
        quantity: qtyNum,
        responseComment: comment.trim() || null,
        photo,
        clearImage,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface-container-low p-3 text-xs">
      {existing ? (
        <p className="rounded-md bg-primary-soft p-2 text-primary">
          У вас уже есть ответ от {new Date(existing.updatedAtUtc).toLocaleDateString("ru-RU")} — отправка перезапишет его.
        </p>
      ) : null}
      <input
        type="text"
        placeholder="Полное название (как на упаковке)"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        maxLength={256}
        className="stitch-input w-full"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          min={0.01}
          placeholder="Цена, TJS"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="stitch-input"
        />
        <input
          type="number"
          min={1}
          placeholder="Кол-во в наличии"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="stitch-input"
        />
      </div>
      <input
        type="text"
        placeholder="Комментарий (необязательно)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        className="stitch-input w-full"
      />
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-on-surface-variant">
          <Icon name="camera" size={14} />
          <span>Фото (необязательно)</span>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/*"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] ?? null);
              setClearImage(false);
            }}
            className="hidden"
          />
          <span className="ml-2 text-on-surface">{photo ? photo.name : (existing?.imageUrl ? "Уже есть" : "не выбрано")}</span>
        </label>
        {existing?.imageUrl && !photo ? (
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-secondary">
            <input
              type="checkbox"
              checked={clearImage}
              onChange={(e) => setClearImage(e.target.checked)}
            />
            <span>Удалить старое фото</span>
          </label>
        ) : null}
        {photo ? (
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="ml-2 text-on-surface-variant hover:text-secondary"
          >
            убрать
          </button>
        ) : null}
      </div>
      {existing?.imageUrl ? (
        <div className="h-24 w-24 overflow-hidden rounded-md bg-surface-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveManualLookupImageUrl(existing.imageUrl)}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      {error ? <p className="text-secondary">{error}</p> : null}
      <div className="flex justify-end">
        <Button size="sm" loading={submitting} onClick={submit}>
          {existing ? "Обновить ответ" : "Отправить ответ"}
        </Button>
      </div>
    </div>
  );
}
