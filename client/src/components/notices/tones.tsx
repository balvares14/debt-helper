import type { ReactNode } from "react";

export type NoticeTone = "success" | "error" | "warning" | "info" | "neutral";

export interface NoticeColors {
  bg: string;
  border: string;
  accent: string;
  text: string;
}

/** Type presets. Any channel can be overridden via color / borderColor / accentColor / textColor. */
export const NOTICE_TONES: Record<NoticeTone, NoticeColors> = {
  success: { bg: "#ecfdf5", border: "#a7f3d0", accent: "#059669", text: "#065f46" },
  error: { bg: "#fff1f2", border: "#fecdd3", accent: "#e11d48", text: "#881337" },
  warning: { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", text: "#92400e" },
  info: { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb", text: "#1e3a8a" },
  neutral: { bg: "#fafaf9", border: "#e7e5e4", accent: "#57534e", text: "#1c1917" },
};

const iconFrame = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  "aria-hidden": true,
} as const;

export function ToneIcon({ tone }: { tone: NoticeTone | "spinner" }) {
  if (tone === "spinner") return null;

  if (tone === "success") {
    return (
      <svg {...iconFrame}>
        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.2 9.2 7.7 11.6 12.8 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg {...iconFrame}>
        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6.2 6.2 11.8 11.8M11.8 6.2 6.2 11.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg {...iconFrame}>
        <path d="M9 2.4 16.2 15.2H1.8L9 2.4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 7.2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9" cy="13.4" r="0.8" fill="currentColor" />
      </svg>
    );
  }

  if (tone === "info") {
    return (
      <svg {...iconFrame}>
        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 8.1v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9" cy="5.6" r="0.85" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg {...iconFrame}>
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Default icon for a tone. Pass `icon="none"` or `icon={custom}` to replace. */
export function defaultToneIcon(tone: NoticeTone | string): ReactNode {
  if (tone === "none" || tone === "spinner") return null;
  if (tone === "success" || tone === "error" || tone === "warning" || tone === "info" || tone === "neutral") {
    return <ToneIcon tone={tone} />;
  }
  return <ToneIcon tone="info" />;
}
