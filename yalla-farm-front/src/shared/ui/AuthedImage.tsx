"use client";

import { useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { env } from "@/shared/config/env";

type AuthedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /**
   * Path on the API (e.g. `/api/prescriptions/images/{id}/content`).
   * Falsy values render the fallback instead of issuing a request.
   */
  src?: string | null;
  /** Rendered when src is empty or the request fails. */
  fallback?: React.ReactNode;
  /**
   * Defer the fetch until the placeholder enters the viewport
   * (IntersectionObserver, 200px rootMargin). Long lists of authed
   * images (e.g. /prescriptions, /orders) used to fire 10+ parallel
   * fetches the moment the page mounted, which queued up against the
   * per-origin connection pool and starved the next page's API calls.
   * Off by default — small consumers don't need the IO churn.
   */
  lazy?: boolean;
};

/**
 * `<img>` replacement that loads protected API endpoints by attaching
 * the JWT, downloading the bytes, and turning the response into a blob
 * URL. Native `<img src>` can't send Authorization headers, so we have
 * to do this dance for any auth-gated image (e.g. prescription scans).
 *
 * Each fetch is wired to an AbortController. Without it, the long
 * /prescriptions list could leave 10+ in-flight image fetches running
 * against the per-origin connection pool even after the user clicked
 * away — the next page's API calls then queued behind those abandoned
 * downloads and felt frozen. Aborting on unmount / src swap lets the
 * destination page hit the network immediately.
 *
 * Object URLs are revoked on unmount / src change, so this leaks no
 * memory across re-renders.
 */
export function AuthedImage({ src, fallback = null, alt = "", lazy = false, ...rest }: AuthedImageProps) {
  const token = useAppSelector((s) => s.auth.token);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // When `lazy=false` the fetch fires immediately (legacy behaviour);
  // when `lazy=true` we wait for the placeholder to enter the viewport.
  const [inView, setInView] = useState(!lazy);
  const placeholderRef = useRef<HTMLSpanElement | null>(null);

  // IntersectionObserver — only when lazy and not yet visible. 200px
  // rootMargin starts the fetch slightly before the row scrolls in so
  // the image is usually ready when the user actually sees it.
  useEffect(() => {
    if (!lazy || inView) return;
    const node = placeholderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // No IO support (e.g. SSR snapshot): fall through and load eagerly
      // so we never leave a row permanently blank.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, inView]);

  useEffect(() => {
    setFailed(false);
    // Clear the previous blob URL up front so a src change (e.g. user navigating
    // /prescriptions/A → /prescriptions/B) immediately renders the fallback
    // instead of leaving the OLD image on screen while the new bytes download.
    setBlobUrl(null);
    if (!src || !token || !inView) return;

    const controller = new AbortController();
    let cancelled = false;
    let createdUrl: string | null = null;

    const url = src.startsWith("http") ? src : `${env.apiBaseUrl}${src}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        // AbortError is expected on unmount / src swap — not a real failure.
        if (cancelled || (err && err.name === "AbortError")) return;
        setFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, token, inView]);

  if (!src || failed || !blobUrl) {
    // Wrap fallback in a real block-level element so IntersectionObserver
    // has a box to track (display:contents has no layout box and IO
    // silently never fires, which used to leave lazy=true rows blank
    // forever inside scrollable modals/lists). The wrapper fills the
    // parent slot — the existing fallback usually renders a 100%/100%
    // div, so the visible result is unchanged.
    return (
      <span
        ref={placeholderRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        {fallback}
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl} alt={alt} {...rest} />;
}
