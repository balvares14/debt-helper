import { BrowserRouter as Router, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PlanProvider } from "@/contexts/PlanContext";
import { ToastHost } from "@/shell/Toast";
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import CalendarPage from "@/pages/CalendarPage";
import SetupPage from "@/pages/SetupPage";
import PlanPage from "@/pages/PlanPage";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import "./App.css";

/**
 * Layout for the planner pages.
 *
 * One PlanProvider wraps all three, so the calendar, the plan and the setup
 * screen read the same projection and an edit made on one is already visible
 * on the others.
 */
function PlannerLayout() {
  return (
    <ProtectedRoute>
      <PlanProvider>
        <Outlet />
      </PlanProvider>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastHost>
          <Router>
            <div className="App">
              <Navigation />
              <main style={{ paddingTop: "40px" }}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />

                  <Route element={<PlannerLayout />}>
                    <Route path="/" element={<CalendarPage />} />
                    <Route path="/plan" element={<PlanPage />} />
                    <Route path="/setup" element={<SetupPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </Router>
        </ToastHost>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
