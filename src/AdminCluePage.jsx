import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminCluePage.css";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function AdminCluePage() {
  const navigate = useNavigate();

  const [clueDate, setClueDate] = useState(getToday());
  const [clueTitle, setClueTitle] = useState("");
  const [clueText, setClueText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [unlocksWheel, setUnlocksWheel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingClue, setLoadingClue] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadClueForDate(clueDate);
  }, [clueDate]);

  const loadClueForDate = async (date) => {
    setLoadingClue(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("clues")
      .select("*")
      .eq("clue_date", date)
      .maybeSingle();

    if (error) {
      setStatusMessage("Could not load clue for that date.");
      setLoadingClue(false);
      return;
    }

    if (data) {
      setClueTitle(data.clue_title || "");
      setClueText(data.clue_text || "");
      setAnswerText(data.answer_text || "");
      setMaxAttempts(data.max_attempts ?? 3);
      setUnlocksWheel(Boolean(data.unlocks_wheel));
    } else {
      setClueTitle("");
      setClueText("");
      setAnswerText("");
      setMaxAttempts(3);
      setUnlocksWheel(true);
    }

    setLoadingClue(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!clueDate || !clueText.trim() || !answerText.trim()) {
      setStatusMessage("Please fill out the date, clue, and answer.");
      return;
    }

    setLoading(true);
    setStatusMessage("");

    const monthKey = clueDate.slice(0, 7);

    const { error } = await supabase.from("clues").upsert(
      {
        clue_date: clueDate,
        month_key: monthKey,
        clue_type: "daily",
        clue_title: clueTitle.trim(),
        clue_text: clueText.trim(),
        answer_text: answerText.trim().toLowerCase(),
        max_attempts: Number(maxAttempts) || 3,
        unlocks_wheel: unlocksWheel,
        is_active: true,
      },
      { onConflict: "clue_date" }
    );

    if (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    } else {
      setStatusMessage("Clue saved successfully.");
    }

    setLoading(false);
  };

  return (
    <div className="admin-clue-page">
      <header className="admin-clue-header">
        <div>
          <p className="admin-clue-kicker">Lion Nation Admin</p>
          <h1>Manage Daily Clue</h1>
          <p className="admin-clue-subtitle">
            Create or update the clue agents will see for a specific day.
          </p>
        </div>

        <div className="admin-clue-actions">
          <button
            className="admin-clue-secondary-btn"
            onClick={() => navigate("/admin")}
            type="button"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="admin-clue-layout">
        <section className="admin-clue-card">
          <div className="admin-clue-card-top">
            <span className="admin-clue-badge">Clue Setup</span>
          </div>

          <form className="admin-clue-form" onSubmit={handleSave}>
            <label>
              Clue Date
              <input
                type="date"
                value={clueDate}
                onChange={(e) => setClueDate(e.target.value)}
              />
            </label>

            <label>
              Clue Title
              <input
                type="text"
                placeholder="Example: Friday Challenge"
                value={clueTitle}
                onChange={(e) => setClueTitle(e.target.value)}
              />
            </label>

            <label>
              Clue Text
              <textarea
                placeholder="Type the clue agents will see..."
                value={clueText}
                onChange={(e) => setClueText(e.target.value)}
              />
            </label>

            <label>
              Correct Answer
              <input
                type="text"
                placeholder="Type the correct answer..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </label>

            <label>
              Max Attempts
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </label>

            <label className="admin-clue-checkbox">
              <input
                type="checkbox"
                checked={unlocksWheel}
                onChange={(e) => setUnlocksWheel(e.target.checked)}
              />
              Unlock prize wheel if answered correctly
            </label>

            <button className="admin-clue-save-btn" type="submit">
              {loading ? "Saving..." : "Save Clue"}
            </button>
          </form>

          {statusMessage ? (
            <p className="admin-clue-status">{statusMessage}</p>
          ) : null}
        </section>

        <section className="admin-clue-preview-card">
          <div className="admin-clue-card-top">
            <span className="admin-clue-badge">Agent Preview</span>
          </div>

          <h3>{clueTitle || "No title yet"}</h3>
          <p className="admin-clue-preview-text">
            {loadingClue
              ? "Loading clue for selected date..."
              : clueText || "Your clue preview will show here."}
          </p>

          <div className="admin-clue-preview-meta">
            <div className="admin-clue-pill">Date: {clueDate}</div>
            <div className="admin-clue-pill">Attempts: {maxAttempts}</div>
            <div className="admin-clue-pill">
              Prize Wheel: {unlocksWheel ? "Yes" : "No"}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}