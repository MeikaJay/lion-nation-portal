import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./WeeklyFocus.css";

function WeeklyFocus() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [profile, setProfile] = useState(null);
  const [weeklyFocus, setWeeklyFocus] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadWeeklyFocus = async () => {
      try {
        setLoading(true);
        setPageError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate("/login");
          return;
        }

        const [profileResult, focusResult] = await Promise.allSettled([
          supabase
            .from("profiles")
            .select("id, full_name, role")
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

        if (!isMounted) return;

        if (profileResult.status === "fulfilled" && !profileResult.value.error) {
          setProfile(profileResult.value.data || null);
        }

        if (focusResult.status === "fulfilled" && !focusResult.value.error) {
          setWeeklyFocus(focusResult.value.data || null);
        } else {
          setWeeklyFocus(null);
        }
      } catch (error) {
        console.error("Weekly Focus page error:", error);
        if (isMounted) {
          setPageError("Unable to load Weekly Focus right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWeeklyFocus();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const actionItems = normalizeActionItems(weeklyFocus?.action_items);

  return (
    <div className="weekly-focus-shell">
      <aside className="weekly-focus-sidebar">
        <div className="weekly-focus-brand">
          <div className="weekly-focus-brand-icon">🦁</div>
          <div>
            <h1 className="weekly-focus-brand-title">Lion Nation Portal</h1>
            <p className="weekly-focus-brand-subtitle">Agent Dashboard</p>
          </div>
        </div>

        <nav className="weekly-focus-nav">
          <Link to="/portal" className="weekly-focus-nav-link">
            Dashboard
          </Link>
          <Link to="/portal/clue" className="weekly-focus-nav-link">
            Daily Clue
          </Link>
          <Link to="/portal/weekly-focus" className="weekly-focus-nav-link active">
            Weekly Focus
          </Link>
          <Link to="/portal/bingo" className="weekly-focus-nav-link">
            Blackout Bingo
          </Link>
          <Link to="/portal/videos" className="weekly-focus-nav-link">
            Video Message Board
          </Link>
          <Link to="/portal/suggestions" className="weekly-focus-nav-link">
            Suggestion Box
          </Link>
        </nav>

        <div className="weekly-focus-sidebar-footer">
          <div className="weekly-focus-user-card">
            <span className="weekly-focus-user-label">Signed in as</span>
            <strong>{profile?.full_name || "Lion Nation Agent"}</strong>
          </div>

          <button className="weekly-focus-logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>

      <main className="weekly-focus-main">
        <header className="weekly-focus-header">
          <div>
            <p className="weekly-focus-eyebrow">Weekly Direction</p>
            <h2 className="weekly-focus-page-title">Weekly Focus</h2>
            <p className="weekly-focus-page-subtitle">
              A simple view of what you should be focused on this week.
            </p>
          </div>
        </header>

        {pageError ? <div className="weekly-focus-alert">{pageError}</div> : null}

        {loading ? (
          <div className="weekly-focus-loading-card">Loading Weekly Focus...</div>
        ) : (
          <section className="weekly-focus-card">
            {!weeklyFocus ? (
              <div className="weekly-focus-empty">
                <h3>No Weekly Focus Posted Yet</h3>
                <p>
                  There is no active weekly focus right now. Once leadership posts
                  this week’s focus, it will show here.
                </p>
              </div>
            ) : (
              <>
                <div className="weekly-focus-top">
                  <div className="weekly-focus-week-badge">
                    {weeklyFocus.week_label || "Current Week"}
                  </div>
                </div>

                <div className="weekly-focus-section">
                  <span className="weekly-focus-label">Focus</span>
                  <h3 className="weekly-focus-main-title">
                    {weeklyFocus.focus_title || "No focus title"}
                  </h3>
                </div>

                <div className="weekly-focus-section">
                  <span className="weekly-focus-label">What This Week Is About</span>
                  <div className="weekly-focus-message-box">
                    <p>{weeklyFocus.focus_message || "No weekly message provided yet."}</p>
                  </div>
                </div>

                <div className="weekly-focus-section">
                  <span className="weekly-focus-label">What You Should Be Doing</span>

                  {actionItems.length > 0 ? (
                    <ul className="weekly-focus-action-list">
                      {actionItems.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="weekly-focus-message-box">
                      <p>No action items have been added yet.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function normalizeActionItems(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.replace(/^[-•*\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

export default WeeklyFocus;