import { useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";

export interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

const RegisterForm = ({ onSuccess, onSwitchToLogin }: RegisterFormProps) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register } = useAuth();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    const result = await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName,
    );

    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.message ?? "Registration failed.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <h2 style={styles.title}>Register</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.nameRow}>
            <Input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              required
              style={styles.nameInput}
            />
            <Input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              required
              style={styles.nameInput}
            />
          </div>

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
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            style={styles.input}
          />

          <Input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          <Button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? "Creating Account..." : "Register"}
          </Button>
        </form>

        <div style={styles.switchContainer}>
          <p style={styles.switchText}>
            Already have an account?{" "}
            <button type="button" onClick={onSwitchToLogin} style={styles.switchButton}>
              Login here
            </button>
          </p>
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
    maxWidth: "400px",
  },
  title: {
    margin: "0 0 14px",
    color: "var(--ink)",
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  nameRow: { display: "flex", gap: "8px" },
  nameInput: { flex: 1 },
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
} satisfies Record<string, CSSProperties>;

export default RegisterForm;
