import type { CSSProperties } from "react";

/** Shared page chrome. Keep demo pages visually quiet and dense. */
export const pageWrap: CSSProperties = {
  minHeight: "calc(100vh - 40px)",
  background: "var(--bg)",
  padding: "16px",
};

export const pagePanel: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
};

export const mutedBox: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-card)",
  padding: "10px 12px",
  fontSize: "0.8125rem",
  color: "var(--ink-muted)",
};

export const resultOk: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  padding: "10px 12px",
  borderRadius: "var(--r-card)",
  fontSize: "0.8125rem",
};

export const resultBad: CSSProperties = {
  ...resultOk,
};

export const label: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 500,
  color: "var(--ink-muted)",
  fontSize: "0.75rem",
};

export const helpText: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "var(--ink-faint)",
  fontSize: "0.75rem",
  lineHeight: 1.4,
};

export const monoBlock: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  background: "var(--surface-1)",
  border: "1px solid var(--line)",
  padding: "8px 10px",
  borderRadius: "var(--r-xs)",
  fontSize: "0.75rem",
  overflow: "auto",
  margin: "6px 0",
};
