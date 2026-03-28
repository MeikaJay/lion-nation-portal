import { useState } from "react";
import { supabase } from "./supabase";

export default function AdminResetPanel() {
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleResetToday = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset TODAY'S clue attempts, wheel unlocks, and winners for everyone?"
    );

    if (!confirmed) return;

    setLoadingToday(true);
    setStatusMessage("");

    const { data, error } = await supabase.rpc("reset_lion_game", {
      p_scope: "today",
    });

    if (error) {
      setStatusMessage(`Reset failed: ${error.message}`);
      setLoadingToday(false);
      return;
    }

    setStatusMessage(data?.message || "Today's game was reset.");
    setLoadingToday(false);
  };

  const handleResetAll = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset ALL clue attempts, wheel unlocks, and winners for everyone? This clears all game progress."
    );

    if (!confirmed) return;

    setLoadingAll(true);
    setStatusMessage("");

    const { data, error } = await supabase.rpc("reset_lion_game", {
      p_scope: "all",
    });

    if (error) {
      setStatusMessage(`Reset failed: ${error.message}`);
      setLoadingAll(false);
      return;
    }

    setStatusMessage(data?.message || "All game progress was reset.");
    setLoadingAll(false);
  };

  return (
    <section className="admin-reset-card">
      <div className="admin-reset-top">
        <span className="admin-box-badge">Game Controls</span>
      </div>

      <h3>Reset Wheel and Winners</h3>
      <p className="admin-reset-text">
        Use these controls when you want to test, restart the game, or clear out
        wheel results and winner history.
      </p>

      <div className="admin-reset-actions">
        <button
          className="admin-reset-btn"
          onClick={handleResetToday}
          disabled={loadingToday || loadingAll}
        >
          {loadingToday ? "Resetting Today..." : "Reset Today's Game"}
        </button>

        <button
          className="admin-reset-btn admin-reset-btn-danger"
          onClick={handleResetAll}
          disabled={loadingToday || loadingAll}
        >
          {loadingAll ? "Resetting All..." : "Reset All Game Progress"}
        </button>
      </div>

      {statusMessage ? (
        <p className="admin-reset-status">{statusMessage}</p>
      ) : null}
    </section>
  );
}