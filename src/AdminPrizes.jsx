import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminPrizes.css";

export default function AdminPrizes() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminName, setAdminName] = useState("Leader");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");

  const [prizeLabel, setPrizeLabel] = useState("");
  const [prizeWeight, setPrizeWeight] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const [prizes, setPrizes] = useState([]);

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    try {
      setLoading(true);
      setStatusMessage("");
      setStatusType("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const [{ data: profile }, { data: prizeRows, error: prizesError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("prizes")
            .select("*")
            .order("is_active", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (profile?.full_name) {
        setAdminName(profile.full_name.trim().split(" ")[0]);
      }

      if (prizesError) throw prizesError;

      setPrizes(prizeRows || []);
    } catch (error) {
      console.error("Admin prizes load error:", error);
      setStatusType("error");
      setStatusMessage("Unable to load prizes right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSavePrize = async () => {
    if (!prizeLabel.trim()) {
      setStatusType("error");
      setStatusMessage("Prize name is required.");
      return;
    }

    try {
      setSaving(true);
      setStatusMessage("");
      setStatusType("");

      const { error } = await supabase.from("prizes").insert([
        {
          label: prizeLabel.trim(),
          weight: Number(prizeWeight) || 1,
          is_active: isActive,
        },
      ]);

      if (error) throw error;

      setPrizeLabel("");
      setPrizeWeight(1);
      setIsActive(true);

      setStatusType("success");
      setStatusMessage("Prize added successfully.");
      await loadPage();
    } catch (error) {
      console.error("Save prize error:", error);
      setStatusType("error");
      setStatusMessage(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id, currentValue) => {
    try {
      const { error } = await supabase
        .from("prizes")
        .update({ is_active: !currentValue })
        .eq("id", id);

      if (error) throw error;

      await loadPage();
    } catch (error) {
      console.error("Toggle prize error:", error);
      setStatusType("error");
      setStatusMessage(`Update failed: ${error.message}`);
    }
  };

  const handleDeletePrize = async (id) => {
    const confirmed = window.confirm("Delete this prize?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("prizes").delete().eq("id", id);

      if (error) throw error;

      setStatusType("success");
      setStatusMessage("Prize deleted.");
      await loadPage();
    } catch (error) {
      console.error("Delete prize error:", error);
      setStatusType("error");
      setStatusMessage(`Delete failed: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="admin-prizes-loading">Loading prizes...</div>;
  }

  return (
    <div className="admin-prizes-shell">
      <aside className="admin-prizes-sidebar">
        <div className="admin-prizes-sidebar-top">
          <div className="admin-prizes-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="admin-prizes-logo"
            />
            <div>
              <p className="admin-prizes-kicker">Lion Nation Admin</p>
              <h2>{adminName}</h2>
            </div>
          </div>
        </div>

        <nav className="admin-prizes-nav">
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin")}>
            Dashboard
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/clue")}>
            Daily Clue
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/content")}>
            Portal Content
          </button>
          <button className="admin-prizes-nav-btn active" onClick={() => navigate("/admin/prizes")}>
            Prize Wheel
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/weekly-focus")}>
            Weekly Focus
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/sales-tip")}>
            Sales Tip
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/videos")}>
            Video Message
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/bingo")}>
            Blackout Bingo
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/sales")}>
            Sales Leaderboard
          </button>
          <button className="admin-prizes-nav-btn" onClick={() => navigate("/admin/suggestions")}>
            Suggestions
          </button>
        </nav>

        <button className="admin-prizes-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="admin-prizes-content">
        <div className="admin-prizes-page-head">
          <div>
            <p className="admin-prizes-kicker">Admin Control</p>
            <h1>Prize Wheel</h1>
            <p className="admin-prizes-subtitle">
              Add, activate, deactivate, and remove prizes that can be won from the clue wheel.
            </p>
          </div>
        </div>

        {statusMessage ? (
          <div className={`admin-prizes-status ${statusType === "success" ? "success" : "error"}`}>
            {statusMessage}
          </div>
        ) : null}

        <section className="admin-prizes-card">
          <h3>Add Prize</h3>

          <div className="admin-prizes-form-grid">
            <div className="admin-prizes-field">
              <label>Prize Name</label>
              <input
                type="text"
                value={prizeLabel}
                onChange={(e) => setPrizeLabel(e.target.value)}
                placeholder="Example: 15 Minute Break"
              />
            </div>

            <div className="admin-prizes-field">
              <label>Weight</label>
              <input
                type="number"
                min="1"
                value={prizeWeight}
                onChange={(e) => setPrizeWeight(e.target.value)}
              />
            </div>
          </div>

          <label className="admin-prizes-checkbox-row">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Set this prize as active</span>
          </label>

          <div className="admin-prizes-actions">
            <button
              className="admin-prizes-save-btn"
              onClick={handleSavePrize}
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Prize"}
            </button>
          </div>
        </section>

        <section className="admin-prizes-card">
          <h3>Current Prizes</h3>

          {prizes.length === 0 ? (
            <div className="admin-prizes-empty">No prizes added yet.</div>
          ) : (
            <div className="admin-prizes-list">
              {prizes.map((prize) => (
                <div className="admin-prizes-item" key={prize.id}>
                  <div className="admin-prizes-item-left">
                    <p className="admin-prizes-item-name">{prize.label}</p>
                    <p className="admin-prizes-item-meta">
                      Weight: {prize.weight || 1} • {prize.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>

                  <div className="admin-prizes-item-actions">
                    <button
                      className="admin-prizes-small-btn"
                      onClick={() => handleToggleActive(prize.id, prize.is_active)}
                    >
                      {prize.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      className="admin-prizes-small-btn danger"
                      onClick={() => handleDeletePrize(prize.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}