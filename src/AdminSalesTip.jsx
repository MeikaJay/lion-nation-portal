import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminSalesTip.css";

export default function AdminSalesTip() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");
  const [adminName, setAdminName] = useState("Leader");

  const [tipLabel, setTipLabel] = useState("Today's Tip");
  const [tipTitle, setTipTitle] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipPoints, setTipPoints] = useState("");

  useEffect(() => {
    const loadPage = async () => {
      try {
        setLoading(true);
        setStatusMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate("/");
          return;
        }

        const [{ data: profile }, { data: activeTip, error: tipError }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("sales_tips")
              .select("*")
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

        if (profile?.full_name) {
          setAdminName(profile.full_name.split(" ")[0]);
        }

        if (tipError && tipError.code !== "PGRST116") {
          throw tipError;
        }

        if (activeTip) {
          setTipLabel(activeTip.tip_label || "Today's Tip");
          setTipTitle(activeTip.tip_title || "");
          setTipMessage(activeTip.tip_message || "");
          setTipPoints(normalizeTextarea(activeTip.tip_points));
        }
      } catch (error) {
        console.error("Admin sales tip load error:", error);
        setStatusType("error");
        setStatusMessage("Unable to load Sales Tip settings right now.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSave = async () => {
    if (!tipTitle.trim()) {
      setStatusType("error");
      setStatusMessage("Tip title is required.");
      return;
    }

    try {
      setSaving(true);
      setStatusType("");
      setStatusMessage("");

      const cleanedTipPoints = tipPoints
        .split("\n")
        .map((item) => item.replace(/^[-•*\s]+/, "").trim())
        .filter(Boolean)
        .join("\n");

      const { error: deactivateError } = await supabase
        .from("sales_tips")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) throw deactivateError;

      const { error: insertError } = await supabase.from("sales_tips").insert([
        {
          tip_label: tipLabel.trim(),
          tip_title: tipTitle.trim(),
          tip_message: tipMessage.trim(),
          tip_points: cleanedTipPoints,
          is_active: true,
        },
      ]);

      if (insertError) throw insertError;

      setTipPoints(cleanedTipPoints);
      setStatusType("success");
      setStatusMessage("Sales Tip saved successfully.");
    } catch (error) {
      console.error("Admin sales tip save error:", error);
      setStatusType("error");
      setStatusMessage(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-tip-loading">Loading Sales Tip admin...</div>;
  }

  return (
    <div className="admin-tip-shell">
      <aside className="admin-tip-sidebar">
        <div className="admin-tip-sidebar-top">
          <div className="admin-tip-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="admin-tip-logo"
            />
            <div>
              <p className="admin-tip-kicker">Lion Nation Admin</p>
              <h2>{adminName}</h2>
            </div>
          </div>
        </div>

        <nav className="admin-tip-nav">
          <button className="admin-tip-nav-btn" onClick={() => navigate("/admin")}>
            Dashboard
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/clue")}
          >
            Daily Clue
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/content")}
          >
            Portal Content
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/weekly-focus")}
          >
            Weekly Focus
          </button>
          <button
            className="admin-tip-nav-btn active"
            onClick={() => navigate("/admin/sales-tip")}
          >
            Sales Tip
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/videos")}
          >
            Video Message
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/bingo")}
          >
            Blackout Bingo
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/sales")}
          >
            Sales Leaderboard
          </button>
          <button
            className="admin-tip-nav-btn"
            onClick={() => navigate("/admin/suggestions")}
          >
            Suggestions
          </button>
        </nav>

        <button className="admin-tip-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="admin-tip-content">
        <div className="admin-tip-page-head">
          <div>
            <p className="admin-tip-kicker">Admin Control</p>
            <h1>Sales Tip</h1>
            <p className="admin-tip-subtitle">
              Post one active sales tip at a time so agents always see the current
              coaching direction.
            </p>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`admin-tip-status ${
              statusType === "success" ? "success" : "error"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <section className="admin-tip-card">
          <div className="admin-tip-form-grid">
            <div className="admin-tip-field">
              <label>Tip Label</label>
              <input
                type="text"
                value={tipLabel}
                onChange={(e) => setTipLabel(e.target.value)}
                placeholder="Example: Today's Tip"
              />
            </div>

            <div className="admin-tip-field">
              <label>Tip Title</label>
              <input
                type="text"
                value={tipTitle}
                onChange={(e) => setTipTitle(e.target.value)}
                placeholder="Example: Control the Call Early"
              />
            </div>
          </div>

          <div className="admin-tip-field">
            <label>Tip Message</label>
            <textarea
              rows="6"
              value={tipMessage}
              onChange={(e) => setTipMessage(e.target.value)}
              placeholder="Explain why this sales tip matters."
            />
          </div>

          <div className="admin-tip-field">
            <label>Tip Points</label>
            <textarea
              rows="8"
              value={tipPoints}
              onChange={(e) => setTipPoints(e.target.value)}
              placeholder={`Add one item per line
Set expectations at the start
Ask direct questions early
Guide the pace of the call`}
            />
          </div>

          <div className="admin-tip-actions">
            <button
              className="admin-tip-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Sales Tip"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function normalizeTextarea(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}