import type { CSSProperties } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";

/**
 * Example of a protected route. ProtectedRoute redirects anonymous visitors to
 * /auth and sends them back here once they log in.
 */
const Profile = () => {
  const { user, logout } = useAuth();

  const details = [
    { label: "Name", value: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "N/A" },
    { label: "Email", value: user?.email ?? "N/A" },
    { label: "User ID", value: String(user?.id ?? "N/A") },
    {
      label: "Member Since",
      value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A",
    },
  ];

  return (
    <div style={styles.container}>
      <Card
        title="My Profile"
        subtitle="This is a protected page — you must be logged in to see it."
        style={styles.card}
      >
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>User Information</h3>
          <div style={styles.infoGrid}>
            {details.map((detail) => (
              <div key={detail.label} style={styles.infoItem}>
                <span style={styles.label}>{detail.label}</span>
                <span style={styles.value}>{detail.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>How ProtectedRoute Works</h3>
          <div style={styles.explanation}>
            <p>
              <strong>1. Authentication Check:</strong> When you navigate to this page,
              ProtectedRoute checks if you&apos;re logged in.
            </p>
            <p>
              <strong>2. Redirect if Not Logged In:</strong> If not authenticated, you&apos;re sent
              to /auth with your intended destination saved.
            </p>
            <p>
              <strong>3. Return After Login:</strong> After logging in, you&apos;re automatically
              redirected back to where you wanted to go.
            </p>
          </div>
        </div>

        <div style={styles.actions}>
          <Button onClick={logout} style={styles.logoutButton}>
            Logout
          </Button>
        </div>
      </Card>
    </div>
  );
};

const styles = {
  container: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  card: { maxWidth: "640px", margin: "0 auto" },
  section: { marginBottom: "16px" },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--ink-muted)",
    marginBottom: "8px",
    paddingBottom: "6px",
    borderBottom: "1px solid var(--line)",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px",
  },
  infoItem: {
    background: "var(--surface-2)",
    padding: "8px 10px",
    borderRadius: "var(--r-xs)",
    border: "1px solid var(--line)",
  },
  label: { display: "block", fontSize: "0.7rem", color: "var(--ink-faint)", marginBottom: "2px" },
  value: {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--ink)",
    wordBreak: "break-all",
  },
  explanation: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "10px 12px",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
    lineHeight: 1.5,
  },
  actions: { display: "flex", justifyContent: "flex-start", marginTop: "8px" },
  logoutButton: {},
} satisfies Record<string, CSSProperties>;

export default Profile;
