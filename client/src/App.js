import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Login from "./component/auth/Login";
import Register from "./component/auth/Register";
import Chat from "./component/chat/Chat";
import AdminDashboard from "./component/admin/AdminDashboard";
import { login, logout } from "./component/store/actions/authAction";
import { clearAccessToken, refreshAccessToken } from "./api/client";

function AppRoutes() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    const handleAuthExpired = () => {
      clearAccessToken();
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
  }, [dispatch, navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          !authReady ? null : isLoggedIn ? <Navigate to="/chat" replace /> : <Login />
        }
      />
      <Route
        path="/register"
        element={
          !authReady ? null : isLoggedIn ? <Navigate to="/chat" replace /> : <Register />
        }
      />
      <Route
        path="/chat"
        element={
          !authReady ? null : isLoggedIn ? <Chat /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/admin"
        element={
          !authReady ? null : isLoggedIn && isAdmin ? (
            <AdminDashboard />
          ) : isLoggedIn ? (
            <Navigate to="/chat" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
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
