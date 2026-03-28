import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";

import AdminPrizes from "./AdminPrizes";
import AdminWeeklyFocus from "./AdminWeeklyFocus";
import AdminSalesTip from "./AdminSalesTip";
import SuggestionBox from "./SuggestionBox";
import App from "./App";
import PortalHome from "./PortalHome";
import AdminHome from "./AdminHome";
import AdminCluePage from "./AdminCluePage";
import AdminSuggestionsPage from "./AdminSuggestionsPage";
import AdminPortalContent from "./AdminPortalContent";
import AdminVideoMessage from "./AdminVideoMessage";
import PortalVideos from "./PortalVideos";
import AdminBingo from "./AdminBingo";
import PortalBingo from "./PortalBingo";
import AdminSalesLeaderboard from "./AdminSalesLeaderboard";
import PortalSalesLeaderboard from "./PortalSalesLeaderboard";
import WeeklyFocus from "./WeeklyFocus";
import SalesTip from "./SalesTip"; // ✅ ADD THIS

import "./index.css";

function ProtectedRoute({ children }) {
  const [session, setSession] = React.useState(undefined);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  return session ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    const checkRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus("denied");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.role === "admin" || profile?.role === "leader") {
        setStatus("allowed");
      } else {
        setStatus("denied");
      }
    };

    checkRole();
  }, []);

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  return status === "allowed" ? children : <Navigate to="/portal" replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />

        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <PortalHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/weekly-focus"
          element={
            <ProtectedRoute>
              <WeeklyFocus />
            </ProtectedRoute>
          }
        />

        {/* ✅ NEW SALES TIP ROUTE */}
        <Route
          path="/portal/sales-tip"
          element={
            <ProtectedRoute>
              <SalesTip />
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/videos"
          element={
            <ProtectedRoute>
              <PortalVideos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/bingo"
          element={
            <ProtectedRoute>
              <PortalBingo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/sales"
          element={
            <ProtectedRoute>
              <PortalSalesLeaderboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminHome />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/clue"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminCluePage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/suggestions"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminSuggestionsPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/content"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPortalContent />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/videos"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminVideoMessage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/bingo"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminBingo />
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/sales"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminSalesLeaderboard />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
  path="/admin/weekly-focus"
  element={
    <ProtectedRoute>
      <AdminRoute>
        <AdminWeeklyFocus />
      </AdminRoute>
    </ProtectedRoute>
  }
/>
        <Route
  path="/portal/suggestions"
  element={
    <ProtectedRoute>
      <SuggestionBox />
    </ProtectedRoute>
  }
/>
<Route
  path="/admin/prizes"
  element={
    <ProtectedRoute>
      <AdminRoute>
        <AdminPrizes />
      </AdminRoute>
    </ProtectedRoute>
  }
/>
<Route
  path="/admin/sales-tip"
  element={
    <ProtectedRoute>
      <AdminRoute>
        <AdminSalesTip />
      </AdminRoute>
    </ProtectedRoute>
  }
/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);