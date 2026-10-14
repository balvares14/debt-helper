import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const NavItem = ({
  to,
  children,
  emphasis = false,
}: {
  to: string;
  children: ReactNode;
  emphasis?: boolean;
}) => {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      style={{
        ...styles.link,
        ...(emphasis ? styles.emphasisLink : {}),
        ...(active ? styles.activeLink : {}),
      }}
    >
      {children}
    </Link>
  );
};

const Navigation = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          Debt Planner
        </Link>
        <div style={styles.links}>
          {isAuthenticated ? (
            <>
              <NavItem to="/">Calendar</NavItem>
              <NavItem to="/plan">Plan</NavItem>
              <NavItem to="/setup">Setup</NavItem>
              <NavItem to="/profile">Profile</NavItem>
              <button onClick={logout} style={styles.logoutButton}>
                Logout
              </button>
            </>
          ) : (
            <NavItem to="/auth" emphasis>
              Login
            </NavItem>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    background: "var(--surface-1)",
    borderBottom: "1px solid var(--line)",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: "0",
  },
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 16px",
    height: "40px",
  },
  logo: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--ink)",
    textDecoration: "none",
    letterSpacing: "-0.01em",
  },
  links: { display: "flex", gap: "2px", alignItems: "center" },
  link: {
    color: "var(--ink-muted)",
    textDecoration: "none",
    fontWeight: 450,
    fontSize: "0.75rem",
    padding: "4px 8px",
    borderRadius: "var(--r-xs)",
  },
  activeLink: { color: "var(--ink)", background: "var(--surface-2)" },
  emphasisLink: { color: "var(--ink)" },
  logoutButton: {
    background: "none",
    border: "none",
    color: "var(--ink-muted)",
    padding: "4px 8px",
    borderRadius: "var(--r-xs)",
    cursor: "pointer",
    fontWeight: 450,
    fontSize: "0.75rem",
  },
} satisfies Record<string, CSSProperties>;

export default Navigation;
