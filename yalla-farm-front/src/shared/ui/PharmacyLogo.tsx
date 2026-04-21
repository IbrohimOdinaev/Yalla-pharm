import { Icon } from "./Icon";

type Props = {
  /** Pharmacy identifier — used to build the MinIO-backed URL when iconUrl is a storage key. */
  pharmacyId?: string | null;
  /** Raw iconUrl from the API. If empty, render the fallback SVG instead of a broken <img>. */
  iconUrl?: string | null;
  /** Accessible alt text — defaults to empty since the logo is decorative. */
  alt?: string;
  /** Visual size in pixels for both dimensions. */
  size?: number;
  /** Additional wrapper classes. */
  className?: string;
};

// Renders a pharmacy logo WITHOUT issuing a network request when we know there
// is no icon. Previously every call site built `/api/pharmacies/icon/{id}/content`
// unconditionally and relied on `onError` to hide the broken image — but the
// failed request still landed in the network log as a noisy 404.
export function PharmacyLogo({ pharmacyId, iconUrl, alt = "", size = 40, className = "" }: Props) {
  const hasIcon = Boolean(iconUrl);
  const src = hasIcon
    ? (iconUrl!.startsWith("http") ? iconUrl! : `/api/pharmacies/icon/${pharmacyId}/content`)
    : null;

  const dim = { width: size, height: size };

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-primary-soft text-primary ${className}`}
        style={dim}
        aria-hidden={!alt}
      >
        <Icon name="pharmacy" size={Math.round(size * 0.5)} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`rounded-full object-cover ${className}`}
      style={dim}
    />
  );
}
