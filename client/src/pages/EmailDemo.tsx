import { useCallback, useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/contexts/NotificationContext";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import LoadingOverlay from "@/components/overlays/LoadingOverlay";
import { api, errorMessage, post, type ApiEnvelope } from "@/lib/api";
import { isValidEmail } from "@/utils/helpers";

interface EmailRecord {
  id: number | string;
  type: string;
  subject: string;
  body: string;
  sent_at: string;
  recipients: string[];
  creator_email: string;
  creator_first_name: string;
  creator_last_name: string;
}

type Tab = "compose" | "inbox" | "sent";

const EmailDemo = () => {
  const { user } = useAuth();
  const { showError, toast } = useNotification();

  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [hoveredTab, setHoveredTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipientList, setRecipientList] = useState<string[]>([]);

  const [inboxEmails, setInboxEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);

  const loadAllEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [inbox, sent] = await Promise.all([
        api<ApiEnvelope<EmailRecord[]>>("/api/emails/inbox"),
        api<ApiEnvelope<EmailRecord[]>>("/api/emails/sent"),
      ]);

      setInboxEmails(inbox.data ?? []);
      setSentEmails(sent.data ?? []);
    } catch (error) {
      showError("Failed to load emails", { details: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadAllEmails();
  }, [loadAllEmails]);

  const handleAddRecipient = () => {
    const email = recipientDraft.trim();
    if (!email || recipientList.includes(email)) return;

    if (!isValidEmail(email)) {
      showError("Invalid email address");
      return;
    }

    setRecipientList((previous) => [...previous, email]);
    setRecipientDraft("");
  };

  const handleRecipientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddRecipient();
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim()) return showError("Subject is required");
    if (!body.trim()) return showError("Email body is required");
    if (recipientList.length === 0) return showError("At least one recipient is required");

    setLoading(true);
    try {
      await post("/api/emails/send", {
        subject: subject.trim(),
        body: body.trim(),
        recipients: recipientList,
        type: "Notification",
      });

        toast.success("Email sent successfully!");
      setSubject("");
      setBody("");
      setRecipientDraft("");
      setRecipientList([]);

      await loadAllEmails();
      setActiveTab("sent");
    } catch (error) {
      showError("Failed to send email", { details: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleViewEmail = async (emailId: EmailRecord["id"]) => {
    setLoading(true);
    try {
      const response = await api<ApiEnvelope<EmailRecord>>(`/api/emails/${emailId}`);
      if (response.data) setSelectedEmail(response.data);
    } catch (error) {
      showError("Failed to load email", { details: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (tab: Tab): CSSProperties => {
    if (activeTab === tab) return { ...styles.tab, ...styles.activeTab };
    if (hoveredTab === tab) return { ...styles.tab, ...styles.hoverTab };
    return styles.tab;
  };

  const formatDate = (value: string) => new Date(value).toLocaleString();

  const renderEmailList = (emails: EmailRecord[], emptyMessage: string, mode: Tab) => {
    if (emails.length === 0) {
      return (
        <div style={styles.emptyState}>
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div style={styles.emailList}>
        {emails.map((email) => (
          <div key={email.id} style={styles.emailItem} onClick={() => handleViewEmail(email.id)}>
            <div style={styles.emailHeader}>
              <strong>{email.subject}</strong>
              <span style={styles.emailDate}>{formatDate(email.sent_at)}</span>
            </div>
            <div style={styles.emailMeta}>
              {mode === "inbox"
                ? `From: ${email.creator_first_name} ${email.creator_last_name} (${email.creator_email})`
                : `To: ${email.recipients.join(", ")}`}
            </div>
            <div style={styles.emailPreview}>{email.body.slice(0, 100)}...</div>
          </div>
        ))}
      </div>
    );
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "compose", label: "Compose" },
    { id: "inbox", label: `Inbox (${inboxEmails.length})` },
    { id: "sent", label: `Sent (${sentEmails.length})` },
  ];

  return (
    <div style={styles.container}>
      <LoadingOverlay
        isVisible={loading}
        message={activeTab === "compose" ? "Sending email..." : "Loading..."}
      />

      <Card
        title="Email Demo"
        subtitle={`Send and manage email notifications${user ? ` as ${user.email}` : ""}`}
        style={styles.card}
      >
        <div style={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={tabStyle(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "compose" && (
          <div style={styles.tabContent}>
            <div style={styles.formGroup}>
              <Input
                label="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Enter email subject"
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Recipients <span style={styles.required}>*</span>
              </label>
              <div style={styles.recipientInput}>
                <Input
                  type="email"
                  value={recipientDraft}
                  onChange={(event) => setRecipientDraft(event.target.value)}
                  onKeyDown={handleRecipientKeyDown}
                  placeholder="Enter email address and press Enter"
                  style={{ marginBottom: 0 }}
                />
                <Button onClick={handleAddRecipient} size="small" style={styles.addButton}>
                  Add
                </Button>
              </div>
              {recipientList.length > 0 && (
                <div style={styles.recipientList}>
                  {recipientList.map((email) => (
                    <span key={email} style={styles.recipientTag}>
                      {email}
                      <button
                        onClick={() =>
                          setRecipientList((previous) => previous.filter((item) => item !== email))
                        }
                        style={styles.removeButton}
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <small style={styles.helpText}>
                Bulk demo: BCC everyone, no To (recipients won&apos;t see each other). Use To per recipient for transactional mail — see README.
              </small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Message <span style={styles.required}>*</span>
              </label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Enter email message"
                style={styles.textarea}
                rows={10}
              />
            </div>

            <div style={styles.actions}>
              <Button onClick={handleSendEmail} disabled={loading || recipientList.length === 0}>
                Send Email
              </Button>
            </div>
          </div>
        )}

        {activeTab === "inbox" && (
          <div style={styles.tabContent}>
            {renderEmailList(inboxEmails, "No emails in your inbox", "inbox")}
          </div>
        )}

        {activeTab === "sent" && (
          <div style={styles.tabContent}>
            {renderEmailList(sentEmails, "No sent emails", "sent")}
          </div>
        )}
      </Card>

      {selectedEmail && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedEmail(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>{selectedEmail.subject}</h3>
              <button style={styles.closeButton} onClick={() => setSelectedEmail(null)}>
                ×
              </button>
            </div>
            <div style={styles.modalContent}>
              <div style={styles.modalMeta}>
                <p>
                  <strong>From:</strong> {selectedEmail.creator_first_name}{" "}
                  {selectedEmail.creator_last_name} ({selectedEmail.creator_email})
                </p>
                <p>
                  <strong>To:</strong> {selectedEmail.recipients.join(", ")}
                </p>
                <p>
                  <strong>Sent:</strong> {formatDate(selectedEmail.sent_at)}
                </p>
                <p>
                  <strong>Type:</strong> {selectedEmail.type}
                </p>
              </div>
              {/* Rendered as text, not HTML: bodies are attacker-controlled. */}
              <div style={styles.modalBody}>{selectedEmail.body}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  card: { maxWidth: "720px", margin: "0 auto" },
  tabs: {
    display: "flex",
    borderBottom: "1px solid var(--line)",
    marginBottom: "12px",
    gap: "2px",
  },
  tab: {
    flex: 1,
    padding: "6px 10px",
    textAlign: "center",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--ink-muted)",
    outline: "none",
  },
  activeTab: {
    backgroundColor: "var(--surface-2)",
    color: "var(--ink)",
    borderRadius: "var(--r-xs) var(--r-xs) 0 0",
  },
  hoverTab: { backgroundColor: "var(--surface-2)", color: "var(--ink)" },
  tabContent: { padding: "8px 0" },
  formGroup: { marginBottom: "12px" },
  label: {
    display: "block",
    marginBottom: "4px",
    fontWeight: 500,
    color: "var(--ink-muted)",
    fontSize: "0.75rem",
  },
  required: { color: "var(--ink-muted)" },
  recipientInput: { display: "flex", gap: "8px", alignItems: "flex-start" },
  addButton: { marginTop: 0, whiteSpace: "nowrap" },
  recipientList: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" },
  recipientTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    padding: "3px 8px",
    borderRadius: "var(--r-pill)",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
  },
  removeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "var(--ink-faint)",
    padding: 0,
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: { display: "block", marginTop: "4px", color: "var(--ink-faint)", fontSize: "0.75rem" },
  textarea: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.8125rem",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: "140px",
    boxSizing: "border-box",
    color: "var(--ink)",
    background: "var(--surface-1)",
  },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "12px" },
  emailList: { display: "flex", flexDirection: "column", gap: "6px" },
  emailItem: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "10px 12px",
    cursor: "pointer",
  },
  emailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "4px",
    fontSize: "0.8125rem",
  },
  emailDate: { fontSize: "0.7rem", color: "var(--ink-faint)" },
  emailMeta: { fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "4px" },
  emailPreview: { fontSize: "0.75rem", color: "var(--ink-muted)", lineHeight: 1.45 },
  emptyState: { textAlign: "center", padding: "24px", color: "var(--ink-faint)", fontSize: "0.75rem" },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "16px",
  },
  modal: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    maxWidth: "560px",
    width: "100%",
    maxHeight: "80vh",
    overflow: "auto",
    boxShadow: "var(--elev-3)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid var(--line)",
    fontSize: "0.875rem",
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "1.2rem",
    cursor: "pointer",
    color: "var(--ink-faint)",
    padding: 0,
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { padding: "12px 14px" },
  modalMeta: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    padding: "8px 10px",
    borderRadius: "var(--r-xs)",
    marginBottom: "12px",
    fontSize: "0.75rem",
    lineHeight: 1.6,
    color: "var(--ink-muted)",
  },
  modalBody: { lineHeight: 1.5, color: "var(--ink)", whiteSpace: "pre-wrap", fontSize: "0.8125rem" },
} satisfies Record<string, CSSProperties>;

export default EmailDemo;
