import type { CSSProperties, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helpText?: string;
}

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 500,
  color: "var(--ink-muted)",
  fontSize: "0.75rem",
};

const helpTextStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "var(--ink-faint)",
  fontSize: "0.75rem",
  lineHeight: 1.4,
};

const Input = ({
  label,
  type = "text",
  helpText,
  required = false,
  disabled = false,
  style = {},
  ...props
}: InputProps) => (
  <div>
    {label && (
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: "var(--ink-muted)" }}> *</span>}
      </label>
    )}
    <input
      type={type}
      required={required}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "7px 10px",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-xs)",
        fontSize: "0.8125rem",
        lineHeight: 1.4,
        transition: "border-color 0.15s ease",
        boxSizing: "border-box",
        backgroundColor: disabled ? "var(--surface-2)" : "var(--surface-1)",
        color: disabled ? "var(--ink-faint)" : "var(--ink)",
        cursor: disabled ? "not-allowed" : "text",
        outline: "none",
        ...style,
      }}
      {...props}
    />
    {helpText && <small style={helpTextStyle}>{helpText}</small>}
  </div>
);

export default Input;
