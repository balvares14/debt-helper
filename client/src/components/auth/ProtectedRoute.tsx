import type { CSSProperties, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Gates a route behind authentication.
 *
 *   <Route path="/protected" element={<ProtectedRoute><Page /></ProtectedRoute>} />
 */
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  return <>{children}</>;
};

const styles = {
  loadingContainer: {
    position: "fixed",
    inset: 0,
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
  },
  loadingSpinner: {
    width: "18px",
    height: "18px",
    border: "2px solid var(--line)",
    borderTop: "2px solid var(--ink)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
} satisfies Record<string, CSSProperties>;

export default ProtectedRoute;
