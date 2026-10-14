import { useEffect, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import { readEnvelope, request, type ApiEnvelope } from "@/lib/api";

/** Set by ProtectedRoute so a successful login returns the user where they were. */
interface RedirectState {
  from?: { pathname?: string; search?: string; hash?: string };
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [registrationAllowed, setRegistrationAllowed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as RedirectState | null)?.from;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await readEnvelope<ApiEnvelope<{ allowed?: boolean }>>(
          await request("/api/auth/registration", undefined, { promptOnUnauthorized: false }),
        );
        if (!cancelled) setRegistrationAllowed(Boolean(data.data?.allowed));
      } catch {
        if (!cancelled) setRegistrationAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSuccess = () => {
    if (from?.pathname) {
      navigate(`${from.pathname}${from.search ?? ""}${from.hash ?? ""}`, { replace: true });
    } else {
      navigate("/profile");
    }
  };

  return (
    <div style={styles.container}>
      {isLogin || !registrationAllowed ? (
        <LoginForm
          onSuccess={handleSuccess}
          registrationAllowed={registrationAllowed}
          onSwitchToRegister={() => setIsLogin(false)}
        />
      ) : (
        <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  );
};

const styles = {
  container: {
    minHeight: "calc(100vh - 40px)",
    background: "var(--bg)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "24px 16px",
  },
} satisfies Record<string, CSSProperties>;

export default Auth;
