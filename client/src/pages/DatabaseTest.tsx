import { useRef, type CSSProperties } from "react";
import Button from "@/components/common/Button";
import Card from "@/components/common/Card";
import { useNotification } from "@/contexts/NotificationContext";
import { errorMessage, readEnvelope, request, type ApiEnvelope } from "@/lib/api";

interface ConnectionInfo {
  host: string;
  database: string;
  port: number | string;
}

interface DbTestData {
  currentTime: string;
  dbVersion: string;
  connectionInfo: ConnectionInfo;
}

/** On failure the route reports connectionInfo at the top level, not under data. */
interface DbTestResponse extends ApiEnvelope<DbTestData> {
  connectionInfo?: ConnectionInfo;
}

const requiredEnvVars = [
  "DB_HOST=your-database-host",
  "DB_USER=your-database-user",
  "DB_PASSWORD=your-database-password",
  "DB_NAME=your-database-name",
  "DB_PORT=5432",
];

const DatabaseTest = () => {
  const { showNotification } = useNotification();
  const inFlight = useRef(false);

  const testDatabaseConnection = async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    showNotification({
      type: "info",
      title: "Testing database connection",
      message: "Checking your PostgreSQL database…",
      icon: "spinner",
      showOkButton: false,
      showCloseButton: false,
      overlayClose: false,
      escapeClose: false,
    });

    try {
      // Read the body even on a 500 so the real Postgres error reaches the UI.
      const data = await readEnvelope<DbTestResponse>(await request("/api/db-test"));

      if (data.success && data.data) {
        showNotification({
          type: "success",
          title: "Database Connection Successful!",
          message: "Your PostgreSQL database is connected and working properly.",
          details: {
            "Database Version": data.data.dbVersion,
            "Current Time": new Date(data.data.currentTime).toLocaleString(),
            Host: data.data.connectionInfo.host,
            Database: data.data.connectionInfo.database,
            Port: data.data.connectionInfo.port,
          },
        });
      } else {
        showNotification({
          type: "error",
          title: "Database Connection Failed",
          message: data.message ?? "Unable to connect to the database.",
          details: data.error ?? "Please check your database configuration.",
        });
      }
    } catch (error) {
      showNotification({
        type: "error",
        title: "Connection Error",
        message: "Failed to connect to the server.",
        details: errorMessage(error),
      });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div style={styles.container}>
      <Card
        title="Database Connection Test"
        subtitle="Test the connection to your PostgreSQL database configured in the environment variables."
        style={styles.content}
      >
        <div style={styles.testSection}>
          <Button onClick={testDatabaseConnection} style={{ width: "100%", marginBottom: "12px" }}>
            Test Database Connection
          </Button>
        </div>

        <div style={styles.helpSection}>
          <h3>Environment Variables Required:</h3>
          <div style={styles.envVars}>
            {requiredEnvVars.map((envVar) => (
              <code key={envVar}>{envVar}</code>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

const styles = {
  container: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  content: { maxWidth: "640px", margin: "0 auto" },
  testSection: { marginBottom: "16px" },
  helpSection: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    padding: "10px 12px",
    borderRadius: "var(--r-card)",
    marginTop: "16px",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
  },
  envVars: { display: "grid", gap: "4px", marginTop: "8px", fontSize: "0.75rem" },
} satisfies Record<string, CSSProperties>;

export default DatabaseTest;
