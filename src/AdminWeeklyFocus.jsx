import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminWeeklyFocus.css";

export default function AdminWeeklyFocus() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");
  const [adminName, setAdminName] = useState("Leader");

  const [weekLabel, setWeekLabel] = useState("");
  const [focusTitle, setFocusTitle] = useState("");
  const [focusMessage, setFocusMessage] = useState("");
  const [actionItems, setActionItems] = useState("");

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

        const [{ data: profile }, { data: activeFocus, error: focusError }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("weekly_focus")
              .select("*")
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

        if (profile?.full_name) {
          setAdminName(profile.full_name.split(" ")[0]);
        }

        if (focusError && focusError.code !== "PGRST116") {
          throw focusError;
        }

        if (activeFocus) {
          setWeekLabel(activeFocus.week_label || "");
          setFocusTitle(activeFocus.focus_title || "");
          setFocusMessage(activeFocus.focus_message || "");
          setActionItems(normalizeTextarea(activeFocus.action_items));
        }
      } catch (error) {
        console.error("Admin weekly focus load error:", error);
        setStatusType("error");
        setStatusMessage("Unable to load Weekly Focus settings right now.");
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
    if (!weekLabel.trim() || !focusTitle.trim()) {
      setStatusType("error");
      setStatusMessage("Week label and focus title are required.");
      return;
    }

    try {
      setSaving(true);
      setStatusType("");
      setStatusMessage("");

      const cleanedActionItems = actionItems
        .split("\n")
        .map((item) => item.replace(/^[-•*\s]+/, "").trim())
        .filter(Boolean)
        .join("\n");

      const { error: deactivateError } = await supabase
        .from("weekly_focus")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("is_active", true);

      if (deactivateError) throw deactivateError;

      const { error: insertError } = await supabase.from("weekly_focus").insert([
        {
          week_label: weekLabel.trim(),
          focus_title: focusTitle.trim(),
          focus_message: focusMessage.trim(),
          action_items: cleanedActionItems,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;

      setActionItems(cleanedActionItems);
      setStatusType("success");
      setStatusMessage("Weekly Focus saved successfully.");
    } catch (error) {
      console.error("Admin weekly focus save error:", error);
      setStatusType("error");
      setStatusMessage(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-focus-loading">Loading Weekly Focus admin...</div>;
  }

  return (
    <div className="admin-focus-shell">
      <aside className="admin-focus-sidebar">
        <div className="admin-focus-sidebar-top">
          <div className="admin-focus-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="admin-focus-logo"
            />
            <div>
              <p className="admin-focus-kicker">Lion Nation Admin</p>
              <h2>{adminName}</h2>
            </div>
          </div>
        </div>

        <nav className="admin-focus-nav">
          <button className="admin-focus-nav-btn" onClick={() => navigate("/admin")}>
            Dashboard
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/clue")}
          >
            Daily Clue
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/content")}
          >
            Portal Content
          </button>
          <button
            className="admin-focus-nav-btn active"
            onClick={() => navigate("/admin/weekly-focus")}
          >
            Weekly Focus
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/sales-tip")}
          >
            Sales Tip
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/videos")}
          >
            Video Message
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/bingo")}
          >
            Blackout Bingo
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/sales")}
          >
            Sales Leaderboard
          </button>
          <button
            className="admin-focus-nav-btn"
            onClick={() => navigate("/admin/suggestions")}
          >
            Suggestions
          </button>
        </nav>

        <button className="admin-focus-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="admin-focus-content">
        <div className="admin-focus-page-head">
          <div>
            <p className="admin-focus-kicker">Admin Control</p>
            <h1>Weekly Focus</h1>
            <p className="admin-focus-subtitle">
              Post one clear weekly focus for agents. Only one active week should
              be visible at a time.
            </p>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`admin-focus-status ${
              statusType === "success" ? "success" : "error"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <section className="admin-focus-card">
          <div className="admin-focus-form-grid">
            <div className="admin-focus-field">
              <label>Week Label</label>
              <input
                type="text"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                placeholder="Example: Week 1"
              />
            </div>

            <div className="admin-focus-field">
              <label>Focus Title</label>
              <input
                type="text"
                value={focusTitle}
                onChange={(e) => setFocusTitle(e.target.value)}
                placeholder="Example: Book Building and Follow Up"
              />
            </div>
          </div>

          <div className="admin-focus-field">
            <label>Focus Message</label>
            <textarea
              rows="6"
              value={focusMessage}
              onChange={(e) => setFocusMessage(e.target.value)}
              placeholder="Explain what agents should be focused on this week."
            />
          </div>

          <div className="admin-focus-field">
            <label>Action Items</label>
            <textarea
              rows="8"
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              placeholder={`Add one item per line
Work scheduled callbacks first
Turn on distro while cleaning your book
Leave strong notes on every lead`}
            />
          </div>

          <div className="admin-focus-actions">
            <button
              className="admin-focus-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Weekly Focus"}
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