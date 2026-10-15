/**
 * Every colour, radius and shadow resolves to a CSS variable declared in
 * src/tokens.css. Swap that file to rebrand without touching this config or any
 * component, which is what lets pages authored against another design system
 * keep their class names.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        brand: "var(--brand)",
        "brand-strong": "var(--brand-strong)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        focus: "var(--focus)",
        "success-soft": "var(--success-soft)",
        "success-strong": "var(--success-strong)",
        "warning-soft": "var(--warning-soft)",
        "warning-strong": "var(--warning-strong)",
        "danger-soft": "var(--danger-soft)",
        "danger-strong": "var(--danger-strong)",
        "info-soft": "var(--info-soft)",
        "info-strong": "var(--info-strong)",
        "brand-soft": "var(--brand-soft)",
      },
      borderRadius: {
        xs: "var(--r-xs)",
        card: "var(--r-card)",
        lg: "var(--r-lg)",
        pill: "var(--r-pill)",
      },
      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
      },
      fontSize: {
        display: ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "590" }],
        data: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "590" }],
      },
      maxWidth: { prose: "66ch" },
    },
  },
  plugins: [],
};
