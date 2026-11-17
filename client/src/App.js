import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import Login from "./component/auth/Login";
import Register from "./component/auth/Register";
import Chat from "./component/chat/Chat";
import AdminDashboard from "./component/admin/AdminDashboard";
import AuthenticatedLayout from "./component/layout/AuthenticatedLayout";
import { login, logout } from "./component/store/actions/authAction";
import { clearAccessToken, refreshAccessToken } from "./api/client";

function AppRoutes() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    const handleAuthExpired = () => {
      clearAccessToken();
      queryClient.clear();
      dispatch(logout());
      navigate("/", { replace: true });
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    refreshAccessToken()
      .then(({ user }) => dispatch(login(user)))
      .catch((error) => {
        if (error.response?.status !== 401) {
          console.error("Could not restore the login session", error);
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, [dispatch, navigate, queryClient]);

  if (!authReady) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div
          role="status"
          className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-panel"
        >
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent motion-reduce:animate-none"
          />
          <p className="text-sm font-semibold text-ink">
            Đang khôi phục phiên đăng nhập...
          </p>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isLoggedIn ? <Navigate to="/chat" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isLoggedIn ? <Navigate to="/chat" replace /> : <Register />}
      />
      <Route
        element={
          isLoggedIn ? <AuthenticatedLayout /> : <Navigate to="/" replace />
        }
      >
        <Route path="/chat" element={<Chat />} />
        <Route
          path="/admin"
          element={
            isAdmin ? <AdminDashboard /> : <Navigate to="/chat" replace />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
