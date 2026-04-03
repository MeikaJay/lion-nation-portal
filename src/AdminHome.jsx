import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import AdminResetPanel from "./AdminResetPanel";
import AdminWinnerHistory from "./AdminWinnerHistory";
import "./AdminHome.css";

export default function AdminHome() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState("Admin");
  const [loading, setLoading] = useState(true);

  const [todayWinnerName, setTodayWinnerName] = useState("");
  const [todayWinnerPrize, setTodayWinnerPrize] = useState("");
  const [firstCorrectName, setFirstCorrectName] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  useEffect(() => {
    const loadAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        const firstName = profile.full_name.trim().split(" ")[0];
        setUserName(firstName);
      } else if (user.email) {
        const firstPart = user.email.split("@")[0].split(".")[0];
        setUserName(firstPart.charAt(0).toUpperCase() + firstPart.slice(1));
      }

      const { data: todayData } = await supabase.rpc("get_today_game_status");

      if (todayData?.has_clue) {
        setTodayWinnerName(todayData.latest_winner_name || "");
        setTodayWinnerPrize(todayData.latest_winner_prize || "");
        setFirstCorrectName(todayData.first_correct_name || "");
        setCorrectAnswer(todayData.correct_answer || "");
      }

      setLoading(false);
    };

    loadAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const goTo = (path) => navigate(path);

  if (loading) {
    return <div className="admin-loading">Loading admin...</div>;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="admin-logo"
          />
          <div>
            <p className="admin-mini-title">Lion Nation Admin</p>
            <h1>Welcome, {userName}</h1>
          </div>
        </div>

        <button className="admin-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <main className="admin-main">
        <section className="admin-hero-card">
          <div className="admin-hero-copy">
            <p className="admin-hero-tag">Control Center</p>
            <h2>Manage the Lion Nation experience from one place.</h2>
            <p>
              Post the daily clue, review suggestions, monitor winners, manage
              rewards, and control the homepage content agents see first.
            </p>
          </div>

          <div className="admin-hero-actions">
            <button
              className="admin-hero-btn primary"
              onClick={() => goTo("/admin/clue")}
            >
              Manage Daily Clue
            </button>

            <button
              className="admin-hero-btn"
              onClick={() => goTo("/admin/content")}
            >
              Manage Portal Content
            </button>
          </div>
        </section>

        <section className="admin-results-row">
          <div className="admin-results-card">
            <p className="admin-results-label">Today’s Winner</p>
            <h3>{todayWinnerName || "No winner yet"}</h3>
            <p>{todayWinnerPrize || "Prize will show here once someone wins."}</p>
          </div>

          <div className="admin-results-card">
            <p className="admin-results-label">First Correct Guess</p>
            <h3>{firstCorrectName || "No one yet"}</h3>
            <p>{correctAnswer || "Answer will show after first correct guess."}</p>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <p className="admin-section-kicker">Live Management</p>
              <h2>Core Admin Pages</h2>
            </div>
          </div>

          <div className="admin-grid">
            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/clue")}
            >
              <span className="admin-box-badge">Daily Challenge</span>
              <h3>Manage Daily Clue</h3>
              <p>Create, update, and control the clue agents see each day.</p>
            </button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/content")}
            >
              <span className="admin-box-badge">Homepage</span>
              <h3>Manage Announcements</h3>
              <p>Control the important message agents see immediately on login.</p>
            </button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/prizes")}
            >
              <span className="admin-box-badge">Rewards</span>
              <h3>Manage Prize Wheel</h3>
              <p>Set active prizes, organize rewards, and control what can be won.</p>
            </button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/suggestions")}
            >
              <span className="admin-box-badge">Feedback</span>
              <h3>Manage Suggestion Box</h3>
              <p>Review feedback, anonymous submissions, and export-ready ideas.</p>
            </button>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <p className="admin-section-kicker">Portal Features</p>
              <h2>Next Level Engagement</h2>
            </div>
          </div>

          <div className="admin-grid">
            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/videos")}
            >
              <span className="admin-box-badge">Video</span>
              <h3>Manage Video Message</h3>
              <p>Post the Lion Nation Video Message and let agents like and comment.</p>
            </button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/sales")}
            >
              <span className="admin-box-badge">Sales</span>
              <h3>Manage Sales Leaderboard</h3>
              <p>Post daily sales and calculate Top 10 for previous day, month, and quarter.</p>
            </button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/weekly-focus")}
            >
              <span className="admin-box-badge">Morale</span>
              <h3>Manage Weekly Focus</h3>
              <p>Post updates, morale content, and important reminders for agents.</p>
            </button>

            <button
  type="button"
  className="admin-box admin-box-button"
  onClick={() => goTo("/admin/sales-tip")}
>
  <span className="admin-box-badge">Coaching</span>
  <h3>Manage Sales Tip</h3>
  <p>Post one active sales tip at a time to guide agent conversations.</p>
</button>

            <button
              type="button"
              className="admin-box admin-box-button"
              onClick={() => goTo("/admin/bingo")}
            >
              <span className="admin-box-badge">Engagement</span>
              <h3>Manage Bingo</h3>
              <p>Build the live blackout board agents complete in Mega Chat.</p>
            </button>
          </div>
        </section>

        <AdminWinnerHistory />
        <AdminResetPanel />
      </main>
    </div>
  );
}