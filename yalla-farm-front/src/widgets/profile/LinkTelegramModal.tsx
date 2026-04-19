"use client";

import { useEffect, useRef, useState } from "react";
import { startTelegramLink, pollTelegramLink, completeTelegramLink, type TelegramLinkStartResponse } from "@/entities/client/api";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function LinkTelegramModal({ open, token, onClose, onSuccess }: Props) {
  const [session, setSession] = useState<TelegramLinkStartResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "confirmed" | "expired" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStatus("pending");
    startTelegramLink(token)
      .then((s) => { if (!cancelled) setSession(s); })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : "Ошибка"); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [open, token]);

  useEffect(() => {
    if (!session || status !== "pending") return;
    pollRef.current = setInterval(async () => {
      try {
        const { status: s } = await pollTelegramLink(token, session.nonce);
        if (s === "confirmed") {
          clearInterval(pollRef.current!);
          await completeTelegramLink(token, session.nonce);
          setStatus("confirmed");
          onSuccess();
          setTimeout(close, 800);
        } else if (s === "expired" || s === "cancelled") {
          clearInterval(pollRef.current!);
          setStatus("expired");
        }
      } catch (err) {
        clearInterval(pollRef.current!);
        setError(err instanceof Error ? err.message : "Ошибка привязки");
        setStatus("error");
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  function close() {
    setSession(null);
    setStatus("idle");
    setError(null);
    if (pollRef.current) clearInterval(pollRef.current);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-center justify-center p-4" onClick={close}>
      <div className="stitch-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Привязка Telegram</h3>
          <button type="button" onClick={close} className="rounded-xl bg-surface-container-low p-1.5 hover:bg-surface-container-high" aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {status === "confirmed" ? (
          <div className="text-center space-y-2 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm font-semibold">Telegram привязан</p>
          </div>
        ) : status === "expired" ? (
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-on-surface-variant">Сессия истекла. Попробуйте снова.</p>
            <button type="button" className="stitch-button" onClick={close}>Закрыть</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Откройте Telegram-бот и подтвердите привязку.
            </p>
            {session ? (
              <a
                href={session.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="stitch-button w-full inline-flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.943 4.116a1.5 1.5 0 0 0-1.567-.196L2.91 11.123a1.5 1.5 0 0 0 .128 2.787l4.378 1.477 1.69 5.39a1 1 0 0 0 1.69.39l2.42-2.42 4.55 3.34a1.5 1.5 0 0 0 2.367-.94l3-15a1.5 1.5 0 0 0-1.19-1.83zM10 16l-.66 3.13L8 14.5l9-7-7 8.5z"/></svg>
                Открыть бот @{session.botUsername}
              </a>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-on-surface-variant">Подготовка сессии…</span>
              </div>
            )}
            {session ? (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
                Ждём подтверждения в боте…
              </div>
            ) : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
