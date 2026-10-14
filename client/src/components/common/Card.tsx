import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
}

const titleStyle: CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 600,
  color: "var(--ink)",
  margin: "0 0 4px",
  textAlign: "left",
  letterSpacing: "-0.01em",
};

const subtitleStyle: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--ink-muted)",
  lineHeight: 1.45,
  margin: "0 0 16px",
  textAlign: "left",
};

const Card = ({ children, title, subtitle, style = {}, ...props }: CardProps) => (
  <div
    style={{
      background: "var(--surface-1)",
      border: "1px solid var(--line)",
      borderRadius: "var(--r-card)",
      padding: "16px 18px",
      boxShadow: "var(--elev-1)",
      ...style,
    }}
    {...props}
  >
    {title && <h1 style={titleStyle}>{title}</h1>}
    {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
    {children}
  </div>
);

export default Card;
