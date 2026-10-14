import type { CSSProperties } from "react";

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  style?: CSSProperties;
}

const LoadingOverlay = ({ isVisible, message = "Loading...", style = {} }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(248, 250, 252, 0.7)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        ...style,
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          border: "2px solid var(--line)",
          borderTop: "2px solid var(--ink)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
          marginBottom: "8px",
        }}
      />
      <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{message}</div>
    </div>
  );
};

export default LoadingOverlay;
