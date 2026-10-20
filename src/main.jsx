import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";
import App from "./App";
import PortalHome from "./PortalHome";
import LeaderHome from "./LeaderHome";
import AdminHome from "./AdminHome";
import "./index.css";

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      background: "#0a0a0a", color: "white",
      fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <img src="/Lion Nation.png" alt="Lion Nation"
        style={{ width: 90, height: 90, objectFit: "contain" }} />
      <div style={{ color: "#d4af37", fontWeight: 800,
        fontSize: "0.85rem", letterSpacing: "0.08em" }}>LION NATION</div>
      <div style={{ color: "#aaaaaa", fontSize: "0.8rem" }}>Loading portal...</div>
    </div>
  );
}

function RoleRoute({ allowedRoles, children }) {
  const [status, setStatus] = React.useState("loading");
  React.useEffect(() => {
    let mounted = true;
    async function checkAccess() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          if (mounted) setStatus("login");
          return;
        }
        const { data: person, error: personError } = await supabase
          .from("aep_people").select("id, role, is_active")
          .eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
        if (personError || !person) {
          await supabase.auth.signOut();
          if (mounted) setStatus("login");
          return;
        }
        if (mounted) {
          setStatus(allowedRoles.includes(person.role) ? "allowed" :
            ["admin", "leader", "agent"].includes(person.role) ? person.role : "login");
        }
      } catch (error) {
        console.error("Route access error:", error);
        if (mounted) setStatus("login");
      }
    }
    checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT" && mounted) setStatus("login");
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [allowedRoles]);

  if (status === "loading") return <LoadingScreen />;
  if (status === "login") return <Navigate to="/" replace />;
  if (status === "admin") return <Navigate to="/admin" replace />;
  if (status === "leader") return <Navigate to="/leader" replace />;
  if (status === "agent") return <Navigate to="/portal" replace />;
  return children;
}

const agentRoles = ["agent"];
const leaderRoles = ["leader"];
const adminRoles = ["admin"];

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/portal" element={
          <RoleRoute allowedRoles={agentRoles}><PortalHome /></RoleRoute>
        } />
        <Route path="/leader" element={
          <RoleRoute allowedRoles={leaderRoles}><LeaderHome /></RoleRoute>
        } />
        <Route path="/leader/agent/:agentId" element={
          <RoleRoute allowedRoles={leaderRoles}><PortalHome /></RoleRoute>
        } />
        <Route path="/admin" element={
          <RoleRoute allowedRoles={adminRoles}><AdminHome /></RoleRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
