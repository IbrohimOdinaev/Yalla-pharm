"use client";

import { useEffect } from "react";
import { AuthedImage } from "@/shared/ui";
import { useBodyScrollLock } from "@/shared/lib/useBodyScrollLock";

/**
 * Full-screen viewer for an authed image (prescription scan / etc). Reuses
 * `AuthedImage` so it transparently re-fetches the bytes via the JWT — there's
 * no way to hand a blob URL across to a native `<img>` opened in a new tab,
 * so we render the image inside a modal instead.
 *
 * Click the backdrop or the close button to dismiss; ESC also closes.
 */
export function AuthedImageLightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  useBodyScrollLock(Boolean(src));
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition active:scale-95 hover:bg-black/80"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div
        className="max-h-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthedImage
          src={src}
          alt=""
          className="block max-h-modal max-w-full object-contain"
          fallback={
            <div className="flex h-40 w-40 items-center justify-center text-white/70">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          }
        />
      </div>
    </div>
  );
}
