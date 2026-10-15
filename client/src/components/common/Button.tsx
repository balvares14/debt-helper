import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants = {
  primary: {
    background: "var(--brand)",
    color: "#fff",
    boxShadow: "0 6px 16px rgba(79, 168, 85, 0.28)",
  },
  secondary: {
    background: "var(--brand-soft)",
    color: "var(--brand)",
    border: "none",
  },
  danger: {
    background: "var(--danger-soft)",
    color: "var(--danger-strong)",
    border: "none",
  },
} satisfies Record<ButtonVariant, CSSProperties>;

const sizes = {
  small: { padding: "5px 10px", fontSize: "0.75rem" },
  medium: { padding: "7px 12px", fontSize: "0.8125rem" },
  large: { padding: "9px 14px", fontSize: "0.875rem" },
} satisfies Record<ButtonSize, CSSProperties>;

const Button = ({
  children,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "medium",
  style = {},
  ...props
}: ButtonProps) => (
  <button
    disabled={disabled || loading}
    style={{
      border: "none",
      borderRadius: "var(--r-pill)",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 600,
      letterSpacing: "0.01em",
      lineHeight: 1.3,
      ...variants[variant],
      ...sizes[size],
      ...((disabled || loading) ? { opacity: 0.5 } : {}),
      ...style,
    }}
    {...props}
  >
    {loading ? (
      <span style={{ display: "inline-flex", justifyContent: "center" }}>
        <Spinner size={size === "small" ? 14 : 16} />
      </span>
    ) : (
      children
    )}
  </button>
);

export default Button;
