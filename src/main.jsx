import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { supabase } from "./supabase";

import App from "./App";
import PortalHome from "./PortalHome";
import LeaderHome from "./LeaderHome";
import AdminHome from "./AdminHome";

import "./index.css";

/* =========================================================
   LOADING SCREEN
   ========================================================= */

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "#0a0a0a",
        color: "white",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
      }}
    >
      <img
        src="/Lion Nation.png"
        alt="Lion Nation"
        style={{
          width: "90px",
          height: "90px",
          objectFit: "contain",
        }}
      />

      <div
        style={{
          color: "#d4af37",
          fontWeight: "800",
          fontSize: "0.85rem",
          letterSpacing: "0.08em",
        }}
      >
        LION NATION
      </div>

      <div
        style={{
          color: "#aaaaaa",
          fontSize: "0.8rem",
        }}
      >
        Loading portal...
      </div>
    </div>
  );
}

/* =========================================================
   SECURE ROLE ROUTE
   ========================================================= */

function RoleRoute({
  allowedRoles,
  children,
}) {
  const [status, setStatus] =
    React.useState("loading");

  React.useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          if (mounted) {
            setStatus("login");
          }

          return;
        }

        const {
          data: person,
          error: personError,
        } = await supabase
          .from("aep_people")
          .select(`
            id,
            role,
            is_active
          `)
          .eq(
            "auth_user_id",
            user.id
          )
          .eq("is_active", true)
          .maybeSingle();

        if (
          personError ||
          !person
        ) {
          await supabase.auth.signOut();

          if (mounted) {
            setStatus("login");
          }

          return;
        }

        if (
          allowedRoles.includes(
            person.role
          )
        ) {
          if (mounted) {
            setStatus("allowed");
          }

          return;
        }

        if (mounted) {
          if (
            person.role === "admin"
          ) {
            setStatus("admin");
          } else if (
            person.role === "leader"
          ) {
            setStatus("leader");
          } else if (
            person.role === "agent"
          ) {
            setStatus("agent");
          } else {
            setStatus("login");
          }
        }
      } catch (error) {
        console.error(
          "Route access error:",
          error
        );

        if (mounted) {
          setStatus("login");
        }
      }
    }

    checkAccess();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (
            event === "SIGNED_OUT"
          ) {
            setStatus("login");
          }
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "login") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (status === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  if (status === "leader") {
    return (
      <Navigate
        to="/leader"
        replace
      />
    );
  }

  if (status === "agent") {
    return (
      <Navigate
        to="/portal"
        replace
      />
    );
  }

  return children;
}

/* =========================================================
   APP ROUTES
   ========================================================= */

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}

        <Route
          path="/"
          element={<App />}
        />

        {/* AGENT PORTAL */}

        <Route
          path="/portal"
          element={
            <RoleRoute
              allowedRoles={[
                "agent",
              ]}
            >
              <PortalHome />
            </RoleRoute>
          }
        />

        {/* LEADER PORTAL */}

        <Route
          path="/leader"
          element={
            <RoleRoute
              allowedRoles={[
                "leader",
              ]}
            >
              <LeaderHome />
            </RoleRoute>
          }
        />

        {/* ADMIN PORTAL */}

        <Route
          path="/admin"
          element={
            <RoleRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <AdminHome />
            </RoleRoute>
          }
        />

        {/* UNKNOWN ROUTE */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);