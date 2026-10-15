import type { CSSProperties } from "react";

import { Spinner } from "@/components/common/Spinner";

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  style?: CSSProperties;
}

const LoadingOverlay = ({ isVisible, message = "Loading", style = {} }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-label={message}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(248, 250, 252, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        color: "var(--brand)",
        ...style,
      }}
    >
      <Spinner size={28} />
    </div>
  );
};

export default LoadingOverlay;
