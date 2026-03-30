import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminCluePage.css";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function AdminCluePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [clueId, setClueId] = useState(null);
  const [clueDate, setClueDate] = useState(getToday());
  const [clueTitle, setClueTitle] = useState("");
  const [clueText, setClueText] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadClue();
  }, []);

  async function loadClue() {
    setLoading(true);
    setStatusMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/");
      return;
    }

    const { data, error } = await supabase
      .from("clues")
      .select("*")
      .eq("clue_date", getToday())
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      setStatusMessage(`Could not load clue: ${error.message}`);
      setLoading(false);
      return;
    }

    if (data) {
      setClueId(data.id || null);
      setClueDate(data.clue_date || getToday());
      setClueTitle(data.clue_title || "");
      setClueText(data.clue_text || "");
      setCorrectAnswer(data.correct_answer || "");
      setMaxAttempts(data.max_attempts || 3);
      setIsActive(Boolean(data.is_active));
    } else {
      setClueId(null);
      setClueDate(getToday());
      setClueTitle("");
      setClueText("");
      setCorrectAnswer("");
      setMaxAttempts(3);
      setIsActive(true);
    }

    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage("");

    try {
      const payload = {
        clue_date: clueDate,
        clue_title: clueTitle.trim(),
        clue_text: clueText.trim(),
        correct_answer: correctAnswer.trim(),
        max_attempts: Number(maxAttempts) || 3,
        is_active: isActive,
      };

      let error;

      if (clueId) {
        const result = await supabase
          .from("clues")
          .update(payload)
          .eq("id", clueId);

        error = result.error;
      } else {
        const result = await supabase
          .from("clues")
          .insert([payload])
          .select()
          .single();

        error = result.error;

        if (result.data?.id) {
          setClueId(result.data.id);
        }
      }

      if (error) {
        throw error;
      }

      setStatusMessage("Daily clue saved successfully.");
      await loadClue();
    } catch (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!clueId) {
      setStatusMessage("There is no clue to delete.");
      return;
    }

    const confirmed = window.confirm(
      "Delete today’s clue and all related attempts, unlocks, and prize results?"
    );

    if (!confirmed) return;

    setDeleting(true);
    setStatusMessage("");

    try {
      const { error: prizeError } = await supabase
        .from("prize_results")
        .delete()
        .eq("clue_id", clueId);

      if (prizeError) throw prizeError;

      const { error: unlockError } = await supabase
        .from("clue_unlocks")
        .delete()
        .eq("clue_id", clueId);

      if (unlockError) throw unlockError;

      const { error: attemptsError } = await supabase
        .from("clue_attempts")
        .delete()
        .eq("clue_id", clueId);

      if (attemptsError) throw attemptsError;

      const { error: clueError } = await supabase
        .from("clues")
        .delete()
        .eq("id", clueId);

      if (clueError) throw clueError;

      setStatusMessage("Daily clue deleted successfully.");

      setClueId(null);
      setClueDate(getToday());
      setClueTitle("");
      setClueText("");
      setCorrectAnswer("");
      setMaxAttempts(3);
      setIsActive(true);
    } catch (error) {
      setStatusMessage(`Delete failed: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="admin-clue-page">Loading clue page...</div>;
  }

  return (
    <div className="admin-clue-page">
      <header className="admin-clue-header">
        <div>
          <p className="admin-clue-kicker">Admin Control</p>
          <h1>Daily Clue</h1>
          <p className="admin-clue-subtitle">
            Post, update, or delete the clue for today.
          </p>
        </div>

        <button
          className="admin-clue-secondary-btn"
          onClick={() => navigate("/admin")}
        >
          Back to Admin
        </button>
      </header>

      <div className="admin-clue-layout">
        <section className="admin-clue-card">
          <div className="admin-clue-card-top">
            <span className="admin-clue-badge">
              {clueId ? "Editing Today’s Clue" : "Create Today’s Clue"}
            </span>
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
                value={clueTitle}
                onChange={(e) => setClueTitle(e.target.value)}
                placeholder="Example: Daily Clue"
              />
            </label>

            <label>
              Clue Text
              <textarea
                value={clueText}
                onChange={(e) => setClueText(e.target.value)}
                placeholder="Enter today’s clue..."
              />
            </label>

            <label>
              Correct Answer
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Enter the correct answer"
              />
            </label>

            <label>
              Max Attempts
              <input
                type="number"
                min="1"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </label>

            <label className="admin-clue-checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>

            <button
              type="submit"
              className="admin-clue-save-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Clue"}
            </button>

            <button
              type="button"
              className="admin-clue-delete-btn"
              onClick={handleDelete}
              disabled={deleting || !clueId}
            >
              {deleting ? "Deleting..." : "Delete Today’s Clue"}
            </button>
          </form>

          {statusMessage ? (
            <p className="admin-clue-status">{statusMessage}</p>
          ) : null}
        </section>

        <aside className="admin-clue-preview-card">
          <p className="admin-clue-kicker">Preview</p>
          <h3>{clueTitle || "Daily Clue"}</h3>
          <p className="admin-clue-preview-text">
            {clueText || "Your clue preview will show here."}
          </p>

          <div className="admin-clue-preview-meta">
            <span className="admin-clue-pill">Date: {clueDate}</span>
            <span className="admin-clue-pill">Attempts: {maxAttempts}</span>
            <span className="admin-clue-pill">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}