import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  clearToken,
  getToken,
  request,
  setUnauthorizedHandler,
  storeToken,
  type ApiEnvelope,
  type RequestOptions,
} from "@/lib/api";
import { Spinner } from "@/components/common/Spinner";

export interface AuthUser {
  id: number | string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  code?: string;
  currentVersion?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<AuthResult>;
  logout: () => void;
  updateProfile: (firstName: string, lastName: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  /**
   * Authenticated fetch that returns the raw `Response`.
   * New code should prefer the helpers in `@/lib/api`.
   */
  fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
}

interface SessionPayload {
  user: AuthUser;
  token: string;
}

/** The auth routes add `currentVersion` alongside the standard envelope. */
interface AuthEnvelope<T = unknown> extends ApiEnvelope<T> {
  currentVersion?: string;
}

const NETWORK_ERROR: AuthResult = { success: false, message: "Network error. Please try again." };

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

/** Returns `null` when the server answered with something other than JSON. */
async function readJson<T>(response: Response): Promise<AuthEnvelope<T> | null> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  return (await response.json()) as AuthEnvelope<T>;
}

const jsonRequest = (
  path: string,
  method: string,
  body: unknown,
  options?: RequestOptions,
): Promise<Response> =>
  request(
    path,
    { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    options,
  );

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [reauthEmail, setReauthEmail] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);

  // Any 401 from @/lib/api raises the re-login prompt instead of dumping the
  // user back to the login page and losing their place.
  useEffect(() => {
    setUnauthorizedHandler(() => setSessionExpired(true));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // A stale token on a cold load should just be discarded quietly.
        const response = await request("/api/auth/profile", undefined, {
          promptOnUnauthorized: false,
        });
        const payload = await readJson<{ user: AuthUser }>(response);
        if (cancelled) return;

        if (response.ok && payload?.data) {
          setUser(payload.data.user);
        } else {
          clearToken();
          setToken(null);
        }
      } catch {
        if (cancelled) return;
        clearToken();
        setToken(null);
      }

      if (!cancelled) setLoading(false);
    };

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const startSession = useCallback((payload: SessionPayload) => {
    setUser(payload.user);
    setToken(payload.token);
    storeToken(payload.token);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const response = await jsonRequest("/api/auth/login", "POST", { email, password });
        const payload = await readJson<SessionPayload>(response);

        if (response.ok && payload?.success && payload.data) {
          startSession(payload.data);
          return { success: true, message: payload.message };
        }

        const fallback =
          response.status === 403
            ? "Access forbidden. Is the API running on the expected port?"
            : "Login failed. Please check your credentials or try again.";

        return { success: false, message: payload?.message ?? fallback };
      } catch {
        return NETWORK_ERROR;
      }
    },
    [startSession],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ): Promise<AuthResult> => {
      try {
        const response = await jsonRequest("/api/auth/register", "POST", {
          email,
          password,
          firstName,
          lastName,
        });
        const payload = await readJson<SessionPayload>(response);

        if (payload?.success && payload.data) {
          startSession(payload.data);
          return { success: true, message: payload.message };
        }

        return { success: false, message: payload?.message ?? "Registration failed." };
      } catch {
        return NETWORK_ERROR;
      }
    },
    [startSession],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearToken();
  }, []);

  const fetchWithAuth = useCallback(
    (path: string, init?: RequestInit) => request(path, init),
    [],
  );

  const updateProfile = useCallback(
    async (firstName: string, lastName: string): Promise<AuthResult> => {
      try {
        const response = await jsonRequest("/api/auth/profile", "PUT", {
          firstName,
          lastName,
          // Lets the server reject writes made against a stale copy.
          ...(user?.updatedAt ? { version: user.updatedAt } : {}),
        });
        const payload = await readJson<{ user: AuthUser }>(response);

        if (payload?.success && payload.data) {
          setUser(payload.data.user);
          return { success: true, message: payload.message };
        }

        return {
          success: false,
          message: payload?.message,
          code: payload?.code,
          currentVersion: payload?.currentVersion,
        };
      } catch {
        return NETWORK_ERROR;
      }
    },
    [user],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      try {
        const response = await jsonRequest("/api/auth/change-password", "PUT", {
          currentPassword,
          newPassword,
          ...(user?.updatedAt ? { version: user.updatedAt } : {}),
        });
        const payload = await readJson<unknown>(response);

        if (payload?.success) return { success: true, message: payload.message };

        return {
          success: false,
          message: payload?.message,
          code: payload?.code,
          currentVersion: payload?.currentVersion,
        };
      } catch {
        return NETWORK_ERROR;
      }
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      sessionExpired,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      fetchWithAuth,
    }),
    [
      user,
      token,
      loading,
      sessionExpired,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      fetchWithAuth,
    ],
  );

  const handleReauth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReauthError("");
    setReauthLoading(true);

    const result = await login(reauthEmail, reauthPassword);
    setReauthLoading(false);

    if (result.success) {
      setSessionExpired(false);
      setReauthEmail("");
      setReauthPassword("");
    } else {
      setReauthError(result.message ?? "Login failed. Please try again.");
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpired && (
        <div style={modalStyles.backdrop}>
          <div style={modalStyles.modal}>
            <h3 style={modalStyles.title}>Session expired</h3>
            <p style={modalStyles.text}>
              Please log in again to continue. Your current page and data are preserved.
            </p>
            {reauthError && <div style={modalStyles.error}>{reauthError}</div>}
            <form onSubmit={handleReauth} style={modalStyles.form}>
              <label style={modalStyles.label}>Email</label>
              <input
                type="email"
                value={reauthEmail}
                onChange={(event) => setReauthEmail(event.target.value)}
                required
                style={modalStyles.input}
                autoFocus
              />
              <label style={modalStyles.label}>Password</label>
              <input
                type="password"
                value={reauthPassword}
                onChange={(event) => setReauthPassword(event.target.value)}
                required
                style={modalStyles.input}
              />
              <div style={modalStyles.actions}>
                <button type="submit" disabled={reauthLoading} style={modalStyles.primaryBtn}>
                  {reauthLoading ? <Spinner size={16} /> : "Log In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modal: {
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: "14px",
    maxWidth: "360px",
    width: "90%",
    boxShadow: "var(--elev-3)",
  },
  title: { margin: "0 0 4px", color: "var(--ink)", fontSize: "0.875rem", fontWeight: 600 },
  text: { margin: "0 0 12px", color: "var(--ink-muted)", fontSize: "0.8125rem" },
  actions: { display: "flex", gap: "6px", justifyContent: "flex-end" },
  primaryBtn: {
    background: "var(--brand)",
    color: "#fff",
    padding: "8px 16px",
    minWidth: "4.5rem",
    border: "none",
    borderRadius: "var(--r-pill)",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
  },
  form: { display: "grid", gap: "8px" },
  label: { fontSize: "0.75rem", color: "var(--ink-muted)" },
  input: {
    padding: "7px 10px",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    outline: "none",
    fontSize: "0.8125rem",
  },
  error: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    color: "var(--ink)",
    padding: "6px 8px",
    borderRadius: "var(--r-xs)",
    marginBottom: "4px",
    fontSize: "0.75rem",
  },
} satisfies Record<string, CSSProperties>;
