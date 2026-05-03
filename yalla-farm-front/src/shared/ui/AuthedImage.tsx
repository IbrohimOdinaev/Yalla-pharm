"use client";

import { useEffect, useState } from "react";
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
};

/**
 * `<img>` replacement that loads protected API endpoints by attaching
 * the JWT, downloading the bytes, and turning the response into a blob
 * URL. Native `<img src>` can't send Authorization headers, so we have
 * to do this dance for any auth-gated image (e.g. prescription scans).
 *
 * Object URLs are revoked on unmount / src change, so this leaks no
 * memory across re-renders.
 */
export function AuthedImage({ src, fallback = null, alt = "", ...rest }: AuthedImageProps) {
  const token = useAppSelector((s) => s.auth.token);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src || !token) { setBlobUrl(null); return; }

    let cancelled = false;
    let createdUrl: string | null = null;

    const url = src.startsWith("http") ? src : `${env.apiBaseUrl}${src}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src, token]);

  if (!src || failed || !blobUrl) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl} alt={alt} {...rest} />;
}
