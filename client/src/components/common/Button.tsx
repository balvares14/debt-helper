import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants = {
  primary: { background: "var(--ink)", color: "var(--surface-1)" },
  secondary: {
    background: "var(--surface-1)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
  },
  danger: {
    background: "var(--surface-1)",
    color: "var(--ink-muted)",
    border: "1px solid var(--line)",
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
  variant = "primary",
  size = "medium",
  style = {},
  ...props
}: ButtonProps) => (
  <button
    disabled={disabled}
    style={{
      border: "none",
      borderRadius: "var(--r-xs)",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 500,
      letterSpacing: "0.01em",
      lineHeight: 1.3,
      ...variants[variant],
      ...sizes[size],
      ...(disabled ? { opacity: 0.5 } : {}),
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);

export default Button;
