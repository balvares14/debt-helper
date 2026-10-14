import { useCallback, useEffect, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import LoadingOverlay from "@/components/overlays/LoadingOverlay";
import ErrorModal from "@/components/modals/ErrorModal";
import SuccessModal from "@/components/modals/SuccessModal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Card from "@/components/common/Card";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage, readEnvelope, type ApiEnvelope } from "@/lib/api";
import type { NotificationDetails } from "@/components/modals/NotificationModal";

interface MiscellaneousItem {
  id: number | string;
  title: string;
  data: unknown;
  created_at: string;
  insertedBy?: { name: string; email: string };
}

interface ModalData {
  title: string;
  message: string;
  details?: NotificationDetails;
}

type InsertResponse = ApiEnvelope<MiscellaneousItem>;

const formatJsonData = (data: unknown): string => {
  if (data === null || data === undefined) return "null";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const InsertItem = () => {
  const { user, isAuthenticated, fetchWithAuth } = useAuth();
  const [formData, setFormData] = useState({ title: "", data: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InsertResponse | null>(null);
  const [items, setItems] = useState<MiscellaneousItem[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [hasInsertPermission, setHasInsertPermission] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await readEnvelope<ApiEnvelope<MiscellaneousItem[]>>(
        await fetch("/api/miscellaneous"),
      );
      if (data.success && data.data) setItems(data.data);
    } catch (error) {
      console.error("Failed to load items:", errorMessage(error));
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated) {
      setHasInsertPermission(false);
      return;
    }
    try {
      const data = await readEnvelope<ApiEnvelope<{ hasInsert?: boolean }>>(
        await fetchWithAuth("/api/miscellaneous/me/permissions"),
      );
      setHasInsertPermission(Boolean(data.success && data.data?.hasInsert));
    } catch (error) {
      console.error("Failed to load permissions:", errorMessage(error));
      setHasInsertPermission(false);
    }
  }, [fetchWithAuth, isAuthenticated]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const submitTo = async (send: () => Promise<Response>, label: string) => {
    setIsLoading(true);
    setResult(null);
    setShowErrorModal(false);
    setShowSuccessModal(false);

    try {
      const data = await readEnvelope<InsertResponse>(await send());
      setResult(data);

      if (data.success && data.data) {
        const insertedBy = data.data.insertedBy;
        setModalData({
          title: `${label} Inserted Successfully!`,
          message: `"${formData.title}" has been added to the miscellaneous table.`,
          details: {
            ID: data.data.id,
            Title: data.data.title,
            Data: data.data.data,
            "Created At": new Date(data.data.created_at).toLocaleString(),
            ...(insertedBy ? { "Inserted By": `${insertedBy.name} (${insertedBy.email})` } : {}),
          },
        });
        setShowSuccessModal(true);

        setFormData({ title: "", data: "" });
        void loadItems();
      } else {
        setModalData({
          title: `${label} Insert Failed`,
          message: data.message ?? "Unable to insert the item.",
          details: data.error ?? "Please check your input and try again.",
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalData({
        title: "Connection Error",
        message: "Failed to connect to the server.",
        details: errorMessage(error),
      });
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Deliberately a bare fetch: this endpoint accepts anonymous writes.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return submitTo(
      () =>
        fetch("/api/miscellaneous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }),
      "Item",
    );
  };

  // Same payload, but the bearer token decides whether the write is accepted.
  const handleProtectedSubmit = () =>
    submitTo(
      () =>
        fetchWithAuth("/api/miscellaneous/protected", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }),
      "Protected Item",
    );

  // Logged in is not enough: needs miscellaneous.insert on the permissions table.
  const handleAuthorizedSubmit = () =>
    submitTo(
      () =>
        fetchWithAuth("/api/miscellaneous/authorized", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }),
      "Authorized Item",
    );

  const handleGrantPermission = async () => {
    setIsLoading(true);
    try {
      const data = await readEnvelope(
        await fetchWithAuth("/api/miscellaneous/me/permissions", { method: "POST" }),
      );
      if (data.success) {
        setHasInsertPermission(true);
        setModalData({
          title: "Demo permission granted",
          message:
            data.message ??
            "You now have miscellaneous.insert. Try Authorized insert again.",
        });
        setShowSuccessModal(true);
      } else {
        setModalData({
          title: "Could not grant permission",
          message: data.message ?? "The demo grant request failed.",
          details: data.error,
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      setModalData({
        title: "Connection Error",
        message: "Failed to connect to the server.",
        details: errorMessage(error),
      });
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <LoadingOverlay isVisible={isLoading} message="Inserting item..." />

      <Card
        title="Insert Item - Template Example"
        subtitle="Demo only (users, permissions, miscellaneous). Three writes: anonymous, logged in, and logged in with miscellaneous.insert."
        style={styles.content}
      >
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <Input
              label="Title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter item title..."
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="data">
              JSON Data (optional)
            </label>
            <textarea
              id="data"
              name="data"
              value={formData.data}
              onChange={handleInputChange}
              placeholder='{"key": "value", "number": 123, "array": [1, 2, 3]}'
              style={styles.textarea}
              rows={6}
            />
            <small style={styles.helpText}>Enter valid JSON data or leave empty for null</small>
          </div>

          <div style={styles.buttonContainer}>
            <Button type="submit" disabled={isLoading} style={styles.submitButton}>
              {isLoading ? "Inserting..." : "1. Unprotected"}
            </Button>

            <Button
              type="button"
              onClick={handleProtectedSubmit}
              disabled={isLoading}
              style={styles.submitButton}
            >
              {isLoading ? "Inserting..." : "2. Protected (auth)"}
            </Button>

            <Button
              type="button"
              onClick={handleAuthorizedSubmit}
              disabled={isLoading}
              style={styles.submitButton}
            >
              {isLoading ? "Inserting..." : "3. Authorized (permission)"}
            </Button>
          </div>

          <div style={styles.authNotice}>
            {isAuthenticated && user ? (
              <>
                <p>
                  <strong>Logged in as:</strong> {user.firstName} {user.lastName} ({user.email})
                </p>
                <p>
                  <strong>miscellaneous.insert:</strong>{" "}
                  {hasInsertPermission
                    ? "granted — button 3 should succeed"
                    : "missing — button 3 returns 403"}
                </p>
                {!hasInsertPermission && (
                  <p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => void handleGrantPermission()}
                      disabled={isLoading}
                    >
                      Grant demo permission
                    </Button>{" "}
                    Demo only: real apps must not let users grant this to themselves.
                  </p>
                )}
              </>
            ) : (
              <>
                <p>
                  <strong>Logged out.</strong> Button 1 works. Buttons 2 and 3 return 401.
                </p>
                <p>Log in, then 2 works for any user and 3 still needs miscellaneous.insert.</p>
              </>
            )}
          </div>
        </form>

        {result && (
          <div
            style={{
              ...styles.resultContainer,
              ...(result.success ? styles.successResult : styles.errorResult),
            }}
          >
            <h3 style={styles.resultTitle}>{result.success ? "✅ Success" : "❌ Error"}</h3>
            <p style={styles.resultMessage}>{result.message}</p>

            {result.success && result.data && (
              <div style={styles.dataSection}>
                <h4>Inserted Item:</h4>
                <div style={styles.itemDetails}>
                  <div>
                    <strong>ID:</strong> {result.data.id}
                  </div>
                  <div>
                    <strong>Title:</strong> {result.data.title}
                  </div>
                  <div>
                    <strong>Data:</strong>
                  </div>
                  <pre style={styles.jsonPreview}>{formatJsonData(result.data.data)}</pre>
                  <div>
                    <strong>Created:</strong> {new Date(result.data.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {!result.success && result.error && (
              <div style={styles.errorSection}>
                <h4>Error Details:</h4>
                <p style={styles.errorText}>{result.error}</p>
              </div>
            )}
          </div>
        )}

        <div style={styles.itemsSection}>
          <button onClick={() => setShowItems(!showItems)} style={styles.toggleButton}>
            {showItems ? "Hide" : "Show"} Existing Items ({items.length})
          </button>

          {showItems && (
            <div style={styles.itemsList}>
              <h3>Recent Items</h3>
              {items.length === 0 ? (
                <p style={styles.noItems}>No items found</p>
              ) : (
                items.map((item, index) => (
                  <div key={item.id || index} style={styles.itemCard}>
                    <div style={styles.itemHeader}>
                      <strong>{item.title}</strong>
                      <span style={styles.itemDate}>
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={styles.itemData}>
                      <strong>Data:</strong>
                      <pre style={styles.itemJson}>{formatJsonData(item.data)}</pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={modalData?.title}
        message={modalData?.message}
        details={modalData?.details}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={modalData?.title}
        message={modalData?.message}
        details={modalData?.details}
      />
    </div>
  );
};

const styles = {
  container: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  content: { maxWidth: "640px", margin: "0 auto" },
  form: { marginBottom: "16px" },
  formGroup: { marginBottom: "12px" },
  label: {
    display: "block",
    marginBottom: "4px",
    fontWeight: 500,
    color: "var(--ink-muted)",
    fontSize: "0.75rem",
  },
  textarea: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.8125rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    resize: "vertical",
    boxSizing: "border-box",
    color: "var(--ink)",
    background: "var(--surface-1)",
  },
  helpText: { display: "block", marginTop: "4px", color: "var(--ink-faint)", fontSize: "0.75rem" },
  buttonContainer: { display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" },
  submitButton: { flex: "1 1 140px" },
  authNotice: {
    marginTop: "12px",
    padding: "8px 10px",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
  },
  resultContainer: {
    padding: "10px 12px",
    borderRadius: "var(--r-card)",
    marginBottom: "12px",
    border: "1px solid var(--line)",
    background: "var(--surface-2)",
    color: "var(--ink)",
  },
  successResult: {},
  errorResult: {},
  resultTitle: { margin: "0 0 4px", fontSize: "0.8125rem", fontWeight: 600 },
  resultMessage: { margin: "0 0 8px", fontSize: "0.8125rem", color: "var(--ink-muted)" },
  dataSection: { marginTop: "8px" },
  itemDetails: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    padding: "8px 10px",
    borderRadius: "var(--r-xs)",
    fontSize: "0.75rem",
  },
  jsonPreview: {
    background: "var(--surface-2)",
    padding: "8px",
    borderRadius: "var(--r-xs)",
    fontSize: "0.75rem",
    margin: "4px 0",
    overflow: "auto",
    maxHeight: "160px",
  },
  errorSection: { marginTop: "8px" },
  errorText: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    background: "var(--surface-1)",
    padding: "8px",
    borderRadius: "var(--r-xs)",
    fontSize: "0.75rem",
  },
  itemsSection: { marginTop: "16px" },
  toggleButton: {
    width: "100%",
    padding: "7px 10px",
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.8125rem",
    cursor: "pointer",
    marginBottom: "10px",
    color: "var(--ink-muted)",
  },
  itemsList: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    padding: "10px",
    borderRadius: "var(--r-card)",
  },
  noItems: { textAlign: "center", color: "var(--ink-faint)", fontSize: "0.75rem" },
  itemCard: {
    background: "var(--surface-1)",
    padding: "8px 10px",
    borderRadius: "var(--r-xs)",
    marginBottom: "8px",
    border: "1px solid var(--line)",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
    fontSize: "0.8125rem",
  },
  itemDate: { fontSize: "0.7rem", color: "var(--ink-faint)" },
  itemData: { fontSize: "0.75rem" },
  itemJson: {
    background: "var(--surface-2)",
    padding: "6px 8px",
    borderRadius: "var(--r-xs)",
    fontSize: "0.7rem",
    margin: "4px 0",
    overflow: "auto",
    maxHeight: "120px",
  },
} satisfies Record<string, CSSProperties>;

export default InsertItem;
