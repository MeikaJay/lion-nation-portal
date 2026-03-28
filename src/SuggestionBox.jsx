import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./SuggestionBox.css";

export default function SuggestionBox() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("Lion");
  const [userEmail, setUserEmail] = useState("");

  const [suggestion, setSuggestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/");
          return;
        }

        setUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name.trim().split(" ")[0]);
        } else {
          const emailFirstPart = (user.email || "").split("@")[0].split(".")[0] || "Lion";
          setUserName(
            emailFirstPart.charAt(0).toUpperCase() +
              emailFirstPart.slice(1).toLowerCase()
          );
        }
      } catch (error) {
        console.error("Suggestion box load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSubmit = async () => {
    if (!suggestion.trim()) {
      setStatusType("error");
      setStatusMessage("Please enter a suggestion before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setStatusType("");
      setStatusMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { error } = await supabase.from("suggestions").insert([
        {
          profile_id: user.id,
          full_name: isAnonymous ? "Anonymous" : userName,
          email: isAnonymous ? null : userEmail,
          suggestion_text: suggestion.trim(),
          is_anonymous: isAnonymous,
        },
      ]);

      if (error) throw error;

      setSuggestion("");
      setIsAnonymous(false);
      setStatusType("success");
      setStatusMessage("Your suggestion was submitted successfully.");
    } catch (error) {
      console.error("Suggestion submit error:", error);
      setStatusType("error");
      setStatusMessage(`Submission failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="suggestion-loading">Loading suggestion box...</div>;
  }

  return (
    <div className="suggestion-shell">
      <aside className="suggestion-sidebar">
        <div className="suggestion-sidebar-top">
          <div className="suggestion-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="suggestion-logo"
            />
            <div>
              <p className="suggestion-kicker">Lion Nation Portal</p>
              <h2>{userName}</h2>
            </div>
          </div>

          <div className="suggestion-email">{userEmail}</div>
        </div>

        <nav className="suggestion-nav">
          <button className="suggestion-nav-btn" onClick={() => navigate("/portal")}>
            Dashboard
          </button>
          <button
            className="suggestion-nav-btn"
            onClick={() => navigate("/portal/videos")}
          >
            Video Message
          </button>
          <button
            className="suggestion-nav-btn"
            onClick={() => navigate("/portal/sales")}
          >
            Top 10 Sales
          </button>
          <button
            className="suggestion-nav-btn"
            onClick={() => navigate("/portal/bingo")}
          >
            Blackout Bingo
          </button>
          <button
            className="suggestion-nav-btn"
            onClick={() => navigate("/portal/weekly-focus")}
          >
            Weekly Focus
          </button>
          <button
            className="suggestion-nav-btn"
            onClick={() => navigate("/portal/sales-tip")}
          >
            Sales Tip
          </button>
          <button
            className="suggestion-nav-btn active"
            onClick={() => navigate("/portal/suggestions")}
          >
            Suggestion Box
          </button>
        </nav>

        <button className="suggestion-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="suggestion-content">
        <div className="suggestion-page-head">
          <div>
            <p className="suggestion-kicker">Agent Feedback</p>
            <h1>Suggestion Box</h1>
            <p className="suggestion-subtitle">
              Share ideas, concerns, or feedback. You can submit with your name or anonymously.
            </p>
          </div>
        </div>

        {statusMessage ? (
          <div
            className={`suggestion-status ${
              statusType === "success" ? "success" : "error"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <section className="suggestion-card">
          <div className="suggestion-field">
            <label>Your Suggestion</label>
            <textarea
              rows="10"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Type your suggestion here..."
            />
          </div>

          <label className="suggestion-checkbox-row">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            <span>Submit anonymously</span>
          </label>

          <div className="suggestion-actions">
            <button
              className="suggestion-save-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Suggestion"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}