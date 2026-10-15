import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

const features = [
  {
    to: "/database-test",
    title: "🗄️ Database",
    description:
      "PostgreSQL database connection with connection pooling. Test your database connection and view connection info.",
    cta: "Test Connection →",
  },
  {
    to: "/insert-item",
    title: "📝 CRUD Operations",
    description:
      "Demo inserts on miscellaneous: anonymous, logged in, and logged in with the miscellaneous.insert permission.",
    cta: "Try CRUD →",
  },
  {
    to: "/s3-upload",
    title: "☁️ S3 Upload",
    description:
      "Upload files directly to AWS S3 using presigned URLs. Secure, direct-to-S3 uploads without server bottleneck.",
    cta: "Upload Files →",
  },
  {
    to: "/popups",
    title: "Popups",
    description:
      "Demo the loading overlay, centered NotificationModal, and corner FloatingNotice with their parameters.",
    cta: "Open demo →",
  },
  {
    to: "/auth",
    title: "🔐 Authentication",
    description:
      "JWT login. Public register is off unless ALLOW_REGISTER=true; otherwise npm run create-user.",
    cta: "Login →",
  },
  {
    to: "/profile",
    title: "🛡️ Protected Routes",
    description:
      "Example of a protected page that requires login. Try accessing it while logged out to see the redirect.",
    cta: "View Profile →",
  },
  {
    to: "/email-demo",
    title: "📧 Email Notifications",
    description:
      "Bulk send: BCC everyone, no To. View inbox and sent mail. Requires email configuration in .env. Switch to To for transactional mail (see README).",
    cta: "Email Demo →",
  },
];

const Home = () => (
  <div style={styles.container}>
    <div style={styles.content}>
      <h1 style={styles.title}>Debt Planner</h1>
      <p style={styles.subtitle}>
        Map cash flow, schedule payments, and get debt-free sooner.
      </p>

      <div style={styles.featuresSection}>
        <div style={styles.featureGrid}>
          {features.map((feature) => (
            <div key={feature.to} style={styles.featureCard}>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDescription}>{feature.description}</p>
              <Link to={feature.to} style={styles.cardLink}>
                {feature.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.getStarted}>
        <h2 style={styles.getStartedTitle}>Get Started</h2>
        <p style={styles.getStartedText}>
          Check out <code style={styles.code}>README.md</code> for setup instructions, including
          database configuration and environment variables.
        </p>
      </div>
    </div>
  </div>
);

const styles = {
  container: {
    minHeight: "calc(100vh - 40px)",
    background: "var(--bg)",
    padding: "16px",
  },
  content: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "18px 20px",
    maxWidth: "880px",
    margin: "0 auto",
    width: "100%",
  },
  title: {
    fontSize: "1.15rem",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 4px",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    fontSize: "0.8125rem",
    color: "var(--ink-muted)",
    lineHeight: 1.45,
    margin: "0 0 16px",
    maxWidth: "540px",
  },
  featuresSection: { marginBottom: "16px" },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "8px",
  },
  featureCard: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "12px",
    textAlign: "left",
  },
  featureTitle: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 6px",
  },
  featureDescription: {
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
    lineHeight: 1.45,
    margin: "0 0 8px",
  },
  cardLink: {
    color: "var(--ink)",
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "0.75rem",
  },
  getStarted: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "12px",
  },
  getStartedTitle: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 4px",
  },
  getStartedText: {
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
    margin: 0,
    lineHeight: 1.45,
  },
  code: {
    background: "var(--surface-3)",
    padding: "1px 5px",
    borderRadius: "3px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.75rem",
  },
} satisfies Record<string, CSSProperties>;

export default Home;
