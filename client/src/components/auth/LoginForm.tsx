import { useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";

export interface LoginFormProps {
  onSuccess?: () => void;
  registrationAllowed?: boolean;
  onSwitchToRegister?: () => void;
}

const LoginForm = ({ onSuccess, registrationAllowed = false, onSwitchToRegister }: LoginFormProps) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(formData.email, formData.password);

    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.message ?? "Login failed.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <h2 style={styles.title}>Login</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <Input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          <Button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <div style={styles.switchContainer}>
          {registrationAllowed ? (
            <p style={styles.switchText}>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={onSwitchToRegister} style={styles.switchButton}>
                Register here
              </button>
            </p>
          ) : (
            <p style={styles.switchText}>
              Signup is closed. Create an account with{" "}
              <code style={styles.code}>npm run create-user -- email password First Last</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  formContainer: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "16px 18px",
    width: "100%",
    maxWidth: "360px",
  },
  title: {
    margin: "0 0 14px",
    color: "var(--ink)",
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  input: {},
  error: {
    color: "var(--ink)",
    fontSize: "0.75rem",
    padding: "6px 8px",
    background: "var(--surface-2)",
    borderRadius: "var(--r-xs)",
    border: "1px solid var(--line)",
  },
  submitButton: { width: "100%", marginTop: "4px" },
  switchContainer: { textAlign: "left", marginTop: "12px" },
  switchText: { color: "var(--ink-muted)", fontSize: "0.75rem", margin: 0 },
  switchButton: {
    background: "none",
    border: "none",
    color: "var(--ink)",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "0.75rem",
    padding: 0,
  },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.7rem",
    color: "var(--ink)",
  },
} satisfies Record<string, CSSProperties>;

export default LoginForm;
