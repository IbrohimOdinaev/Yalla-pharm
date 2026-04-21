import type { SVGProps } from "react";

export type CategoryIconKey =
  | "thermometer"
  | "allergy"
  | "lungs"
  | "pill"
  | "vitamin"
  | "heart"
  | "stomach"
  | "eye"
  | "skin"
  | "drop"
  | "baby"
  | "moon"
  | "bone"
  | "lipstick"
  | "shield"
  | "grid";

type Props = SVGProps<SVGSVGElement> & { name: CategoryIconKey };

// Illustration-style category icons. Multi-colour flat SVG so the shapes read
// immediately at small sizes — similar feel to big e-commerce pharmacy apps
// (stickers on pastel tiles) without reusing any copyrighted artwork.
export function CategoryIcon({ name, ...rest }: Props) {
  const common = {
    viewBox: "0 0 48 48",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    ...rest,
  };

  switch (name) {
    case "thermometer":
      return (
        <svg {...common}>
          {/* Sun rays */}
          <g stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
            <line x1="34" y1="8" x2="34" y2="5" />
            <line x1="40" y1="11" x2="42" y2="9" />
            <line x1="42" y1="17" x2="45" y2="17" />
          </g>
          {/* Tube */}
          <rect x="21" y="7" width="6" height="24" rx="3" fill="#FEE4DE" stroke="#F87171" strokeWidth="1.5" />
          <rect x="22.5" y="14" width="3" height="16" fill="#F87171" />
          {/* Bulb */}
          <circle cx="24" cy="36" r="7" fill="#F87171" stroke="#DC2626" strokeWidth="1.5" />
          <circle cx="21.5" cy="34" r="1.6" fill="#FECACA" />
        </svg>
      );

    case "allergy":
      return (
        <svg {...common}>
          {/* Petals */}
          <g fill="#F9A8D4" stroke="#DB2777" strokeWidth="1.3">
            <ellipse cx="24" cy="12" rx="5" ry="7" />
            <ellipse cx="12" cy="20" rx="7" ry="5" />
            <ellipse cx="36" cy="20" rx="7" ry="5" />
            <ellipse cx="24" cy="30" rx="5" ry="7" />
          </g>
          {/* Center */}
          <circle cx="24" cy="21" r="5" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1.5" />
          {/* Stem */}
          <path d="M24 26 L24 42" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 36 Q18 34 16 38" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Pollen dots */}
          <g fill="#FBBF24">
            <circle cx="9" cy="8" r="1.5" />
            <circle cx="39" cy="9" r="1.2" />
            <circle cx="6" cy="32" r="1.2" />
            <circle cx="42" cy="33" r="1.5" />
          </g>
        </svg>
      );

    case "lungs":
      return (
        <svg {...common}>
          {/* Trachea */}
          <path d="M24 6 L24 18" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 18 L28 18" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          {/* Left lung */}
          <path
            d="M20 18 C14 18 8 24 8 32 C8 38 10 42 14 42 C18 42 20 38 20 34 Z"
            fill="#BAE6FD"
            stroke="#0284C7"
            strokeWidth="1.5"
          />
          {/* Right lung */}
          <path
            d="M28 18 C34 18 40 24 40 32 C40 38 38 42 34 42 C30 42 28 38 28 34 Z"
            fill="#BAE6FD"
            stroke="#0284C7"
            strokeWidth="1.5"
          />
          {/* Internal bronchi */}
          <path d="M15 26 Q18 28 17 34" stroke="#0284C7" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M33 26 Q30 28 31 34" stroke="#0284C7" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      );

    case "pill":
      return (
        <svg {...common}>
          <defs>
            <clipPath id="pillClip">
              <rect x="8" y="18" width="32" height="12" rx="6" />
            </clipPath>
          </defs>
          <g transform="rotate(-20 24 24)">
            {/* Whole capsule shape */}
            <rect x="8" y="18" width="32" height="12" rx="6" fill="#F8FAFC" stroke="#475569" strokeWidth="1.5" />
            {/* Left half — coral */}
            <rect x="8" y="18" width="16" height="12" fill="#FDA4AF" clipPath="url(#pillClip)" />
            {/* Right half — lilac */}
            <rect x="24" y="18" width="16" height="12" fill="#C4B5FD" clipPath="url(#pillClip)" />
            {/* Divider */}
            <line x1="24" y1="18" x2="24" y2="30" stroke="#475569" strokeWidth="1.5" />
            {/* Highlight */}
            <rect x="11" y="20" width="10" height="2" rx="1" fill="#FFFFFF" opacity="0.7" />
          </g>
        </svg>
      );

    case "vitamin":
      return (
        <svg {...common}>
          {/* Orange slice */}
          <circle cx="24" cy="26" r="15" fill="#FDBA74" stroke="#EA580C" strokeWidth="1.5" />
          <circle cx="24" cy="26" r="10" fill="#FED7AA" />
          {/* Segments */}
          <g stroke="#EA580C" strokeWidth="1.2" strokeLinecap="round">
            <line x1="24" y1="16" x2="24" y2="36" />
            <line x1="14" y1="26" x2="34" y2="26" />
            <line x1="17" y1="19" x2="31" y2="33" />
            <line x1="31" y1="19" x2="17" y2="33" />
          </g>
          <circle cx="24" cy="26" r="2" fill="#FDE68A" stroke="#EA580C" strokeWidth="1" />
          {/* Leaf */}
          <path d="M22 10 Q20 6 24 6 Q28 6 26 10 Z" fill="#4ADE80" stroke="#16A34A" strokeWidth="1" />
          <line x1="24" y1="11" x2="24" y2="14" stroke="#16A34A" strokeWidth="1.2" />
        </svg>
      );

    case "heart":
      return (
        <svg {...common}>
          <path
            d="M24 42 C24 42 6 30 6 18 C6 12 11 8 16 8 C20 8 23 10 24 13 C25 10 28 8 32 8 C37 8 42 12 42 18 C42 30 24 42 24 42 Z"
            fill="#F87171"
            stroke="#DC2626"
            strokeWidth="1.5"
          />
          {/* Highlight */}
          <path
            d="M13 14 Q10 17 11 22"
            stroke="#FCA5A5"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );

    case "stomach":
      return (
        <svg {...common}>
          {/* Body */}
          <path
            d="M18 10 C15 10 13 13 13 16 L13 30 C13 38 20 42 26 42 C33 42 38 37 38 30 C38 26 36 23 32 22 C32 17 28 14 24 14 L22 14 L22 10 Z"
            fill="#FDBA74"
            stroke="#EA580C"
            strokeWidth="1.5"
          />
          {/* Small intestine bend */}
          <path
            d="M34 24 C38 24 40 27 38 30"
            fill="none"
            stroke="#EA580C"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Duodenum entrance */}
          <path d="M22 10 L28 10" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
          {/* Highlights */}
          <path d="M18 20 Q17 26 19 32" stroke="#FED7AA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      );

    case "eye":
      return (
        <svg {...common}>
          {/* Almond shape */}
          <path
            d="M4 24 Q14 10 24 10 Q34 10 44 24 Q34 38 24 38 Q14 38 4 24 Z"
            fill="#FFFFFF"
            stroke="#475569"
            strokeWidth="1.8"
          />
          {/* Iris */}
          <circle cx="24" cy="24" r="9" fill="#60A5FA" stroke="#1E40AF" strokeWidth="1.3" />
          {/* Pupil */}
          <circle cx="24" cy="24" r="4" fill="#1E293B" />
          {/* Shine */}
          <circle cx="21.5" cy="21.5" r="1.8" fill="#FFFFFF" />
          <circle cx="27" cy="26.5" r="0.9" fill="#FFFFFF" />
          {/* Lashes */}
          <g stroke="#334155" strokeWidth="1.3" strokeLinecap="round">
            <line x1="9" y1="16" x2="7" y2="13" />
            <line x1="16" y1="12" x2="15.5" y2="9" />
            <line x1="24" y1="10" x2="24" y2="7" />
            <line x1="32" y1="12" x2="32.5" y2="9" />
            <line x1="39" y1="16" x2="41" y2="13" />
          </g>
        </svg>
      );

    case "skin":
      return (
        <svg {...common}>
          {/* Lotion bottle */}
          <rect x="16" y="18" width="16" height="22" rx="3" fill="#FCE7F3" stroke="#DB2777" strokeWidth="1.5" />
          {/* Label */}
          <rect x="18" y="24" width="12" height="8" rx="1" fill="#FBCFE8" />
          <line x1="20" y1="27" x2="28" y2="27" stroke="#DB2777" strokeWidth="1" strokeLinecap="round" />
          <line x1="20" y1="30" x2="26" y2="30" stroke="#DB2777" strokeWidth="1" strokeLinecap="round" />
          {/* Neck */}
          <rect x="20" y="14" width="8" height="4" fill="#FCE7F3" stroke="#DB2777" strokeWidth="1.5" />
          {/* Cap */}
          <rect x="18" y="8" width="12" height="6" rx="1" fill="#DB2777" />
          {/* Drop */}
          <path d="M36 18 Q39 22 36 26 Q33 22 36 18 Z" fill="#93C5FD" stroke="#2563EB" strokeWidth="1.2" />
        </svg>
      );

    case "drop":
      return (
        <svg {...common}>
          {/* Big blood drop */}
          <path
            d="M24 6 C24 6 12 20 12 30 C12 37 17 42 24 42 C31 42 36 37 36 30 C36 20 24 6 24 6 Z"
            fill="#F87171"
            stroke="#DC2626"
            strokeWidth="1.5"
          />
          {/* Highlight */}
          <path d="M18 20 Q15 26 17 32" stroke="#FECACA" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Plus sign (medical) */}
          <g fill="#FFFFFF">
            <rect x="22" y="26" width="4" height="10" rx="1" />
            <rect x="19" y="29" width="10" height="4" rx="1" />
          </g>
        </svg>
      );

    case "baby":
      return (
        <svg {...common}>
          {/* Teat */}
          <ellipse cx="24" cy="9" rx="3" ry="4" fill="#FDA4AF" stroke="#BE185D" strokeWidth="1.3" />
          {/* Ring */}
          <rect x="18" y="12" width="12" height="3" rx="1.5" fill="#F43F5E" />
          {/* Bottle body */}
          <path
            d="M16 15 L32 15 L32 38 C32 41 30 43 27 43 L21 43 C18 43 16 41 16 38 Z"
            fill="#FEF3C7"
            stroke="#D97706"
            strokeWidth="1.5"
          />
          {/* Milk */}
          <path d="M18 26 L30 26 L30 38 C30 40 28.5 41 27 41 L21 41 C19.5 41 18 40 18 38 Z" fill="#FFFFFF" />
          {/* Measurement marks */}
          <g stroke="#D97706" strokeWidth="1" strokeLinecap="round">
            <line x1="29" y1="20" x2="32" y2="20" />
            <line x1="29" y1="26" x2="32" y2="26" />
            <line x1="29" y1="32" x2="32" y2="32" />
          </g>
        </svg>
      );

    case "moon":
      return (
        <svg {...common}>
          {/* Crescent */}
          <path
            d="M30 10 C20 10 12 18 12 28 C12 37 19 43 28 43 C23 39 21 33 21 27 C21 20 25 13 30 10 Z"
            fill="#C7D2FE"
            stroke="#4338CA"
            strokeWidth="1.5"
          />
          {/* Craters */}
          <circle cx="18" cy="30" r="2" fill="#A5B4FC" />
          <circle cx="23" cy="36" r="1.5" fill="#A5B4FC" />
          {/* ZZZ */}
          <g fill="#6366F1" fontSize="9" fontFamily="sans-serif" fontWeight="700">
            <text x="34" y="16">z</text>
            <text x="38" y="22">z</text>
            <text x="42" y="28">z</text>
          </g>
          {/* Stars */}
          <g fill="#FBBF24">
            <circle cx="36" cy="34" r="1.3" />
            <circle cx="40" cy="40" r="1" />
          </g>
        </svg>
      );

    case "bone":
      return (
        <svg {...common}>
          <g transform="rotate(-30 24 24)">
            {/* Bone shape */}
            <path
              d="M12 18 C12 14 15 12 18 12 C20 12 22 14 22 16 L26 16 C26 14 28 12 30 12 C33 12 36 14 36 18 C36 20 34 22 32 22 C34 22 36 24 36 28 C36 31 34 34 30 34 C28 34 26 32 26 30 L22 30 C22 32 20 34 18 34 C15 34 12 32 12 28 C12 24 14 22 16 22 C14 22 12 20 12 18 Z"
              fill="#FFFFFF"
              stroke="#475569"
              strokeWidth="1.8"
            />
            {/* Shading */}
            <path d="M18 20 L30 20" stroke="#CBD5E1" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </svg>
      );

    case "lipstick":
      return (
        <svg {...common}>
          {/* Base */}
          <rect x="17" y="24" width="14" height="18" rx="2" fill="#1F2937" />
          {/* Ring */}
          <rect x="16" y="22" width="16" height="3" fill="#9CA3AF" />
          {/* Lipstick stick */}
          <rect x="19" y="10" width="10" height="14" fill="#F43F5E" />
          {/* Angled tip */}
          <path d="M19 10 L29 10 L24 4 Z" fill="#E11D48" />
          {/* Highlight */}
          <rect x="20" y="12" width="2" height="10" fill="#FCA5A5" opacity="0.7" />
        </svg>
      );

    case "shield":
      return (
        <svg {...common}>
          {/* Shield body */}
          <path
            d="M24 6 L38 10 L38 26 C38 34 31 40 24 42 C17 40 10 34 10 26 L10 10 Z"
            fill="#34D399"
            stroke="#047857"
            strokeWidth="1.7"
          />
          {/* Highlight */}
          <path d="M14 14 L14 26 C14 30 17 34 21 36" stroke="#6EE7B7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Check */}
          <path d="M16 22 L22 28 L32 18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "grid":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="14" height="14" rx="3" fill="#86EFAC" stroke="#16A34A" strokeWidth="1.3" />
          <rect x="26" y="8" width="14" height="14" rx="3" fill="#FCA5A5" stroke="#DC2626" strokeWidth="1.3" />
          <rect x="8" y="26" width="14" height="14" rx="3" fill="#93C5FD" stroke="#2563EB" strokeWidth="1.3" />
          <rect x="26" y="26" width="14" height="14" rx="3" fill="#FCD34D" stroke="#D97706" strokeWidth="1.3" />
        </svg>
      );
  }
}
