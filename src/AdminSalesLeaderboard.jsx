import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminSalesLeaderboard.css";

const emptyForm = {
  sales_date: new Date().toISOString().split("T")[0],
  agent_name: "",
  sales_count: "",
};

export default function AdminSalesLeaderboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("Admin");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [entries, setEntries] = useState([]);
  const [leaderboardRows, setLeaderboardRows] = useState([]);

  useEffect(() => {
    loadPage();
  }, []);

  const previousDayTop10 = useMemo(() => {
    return [...leaderboardRows]
      .sort((a, b) => b.previous_day_sales - a.previous_day_sales || a.agent_name.localeCompare(b.agent_name))
      .filter((row) => row.previous_day_sales > 0)
      .slice(0, 10);
  }, [leaderboardRows]);

  const monthTop10 = useMemo(() => {
    return [...leaderboardRows]
      .sort((a, b) => b.month_sales - a.month_sales || a.agent_name.localeCompare(b.agent_name))
      .filter((row) => row.month_sales > 0)
      .slice(0, 10);
  }, [leaderboardRows]);

  const quarterTop10 = useMemo(() => {
    return [...leaderboardRows]
      .sort((a, b) => b.quarter_sales - a.quarter_sales || a.agent_name.localeCompare(b.agent_name))
      .filter((row) => row.quarter_sales > 0)
      .slice(0, 10);
  }, [leaderboardRows]);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      navigate("/portal");
      return;
    }

    if (profile?.full_name) {
      setUserName(profile.full_name.trim().split(" ")[0]);
    }

    const { data: entryRows, error: entryError } = await supabase
      .from("portal_sales_scores")
      .select("*")
      .order("sales_date", { ascending: false })
      .order("agent_name", { ascending: true });

    if (entryError) {
      setMessage(`Could not load sales entries: ${entryError.message}`);
    } else {
      setEntries(entryRows || []);
    }

    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from("portal_sales_leaderboard_view")
      .select("*");

    if (leaderboardError) {
      setMessage((prev) =>
        prev
          ? `${prev} Could not load leaderboard: ${leaderboardError.message}`
          : `Could not load leaderboard: ${leaderboardError.message}`
      );
    } else {
      setLeaderboardRows(leaderboardData || []);
    }

    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const salesCount = Number(form.sales_count);

    if (!form.sales_date) {
      setMessage("Sales date is required.");
      setSaving(false);
      return;
    }

    if (!form.agent_name.trim()) {
      setMessage("Agent name is required.");
      setSaving(false);
      return;
    }

    if (Number.isNaN(salesCount) || salesCount < 0) {
      setMessage("Sales count must be 0 or greater.");
      setSaving(false);
      return;
    }

    const payload = {
      sales_date: form.sales_date,
      agent_name: form.agent_name.trim(),
      sales_count: salesCount,
    };

    let error;

    if (editingId) {
      const response = await supabase
        .from("portal_sales_scores")
        .update(payload)
        .eq("id", editingId);

      error = response.error;
    } else {
      const response = await supabase
        .from("portal_sales_scores")
        .insert(payload);

      error = response.error;
    }

    if (error) {
      setMessage(`Could not save sales entry: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage(editingId ? "Sales entry updated." : "Sales entry added.");
    resetForm();
    await loadPage();
    setSaving(false);
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setForm({
      sales_date: entry.sales_date,
      agent_name: entry.agent_name,
      sales_count: entry.sales_count,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this sales entry?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("portal_sales_scores")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`Could not delete entry: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Sales entry deleted.");
    await loadPage();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function renderTop10Card(title, rows, salesKey) {
    return (
      <div className="admin-sales-board-card">
        <div className="admin-sales-board-head">
          <p className="admin-sales-board-kicker">Top 10</p>
          <h3>{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className="admin-sales-empty">No sales posted yet.</div>
        ) : (
          <div className="admin-sales-rank-list">
            {rows.map((row, index) => (
              <div className="admin-sales-rank-item" key={`${title}-${row.agent_name}`}>
                <div className="admin-sales-rank-left">
                  <span className="admin-sales-rank-number">#{index + 1}</span>
                  <span className="admin-sales-rank-name">{row.agent_name}</span>
                </div>
                <span className="admin-sales-rank-score">{row[salesKey]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="admin-sales-loading">Loading sales leaderboard...</div>;
  }

  return (
    <div className="admin-sales-page">
      <header className="admin-sales-header">
        <div className="admin-sales-brand">
          <img src="/Lion Nation.png" alt="Lion Nation" className="admin-sales-logo" />
          <div>
            <p className="admin-sales-mini-title">Lion Nation Admin</p>
            <h1>Sales Leaderboard</h1>
            <p className="admin-sales-subtitle">
              Welcome, {userName}. Track the Top 10 in site sales.
            </p>
          </div>
        </div>

        <div className="admin-sales-header-actions">
          <button
            className="admin-sales-secondary-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
          <button
            className="admin-sales-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="admin-sales-main">
        <section className="admin-sales-hero">
          <p className="admin-sales-tag">Sales Only</p>
          <h2>Post daily sales and let the system rank the site</h2>
          <p>
            This board calculates Top 10 for previous day, current month, and current quarter.
          </p>
        </section>

        <section className="admin-sales-layout">
          <div className="admin-sales-form-card">
            <div className="admin-sales-card-head">
              <div>
                <p className="admin-sales-card-kicker">Daily Entry</p>
                <h3>{editingId ? "Edit Sales Entry" : "Add Sales Entry"}</h3>
              </div>
            </div>

            <form className="admin-sales-form" onSubmit={handleSave}>
              <label>
                Sales Date
                <input
                  type="date"
                  name="sales_date"
                  value={form.sales_date}
                  onChange={handleChange}
                />
              </label>

              <label>
                Agent Name
                <input
                  type="text"
                  name="agent_name"
                  value={form.agent_name}
                  onChange={handleChange}
                  placeholder="Enter agent name"
                />
              </label>

              <label>
                Sales Count
                <input
                  type="number"
                  min="0"
                  name="sales_count"
                  value={form.sales_count}
                  onChange={handleChange}
                  placeholder="0"
                />
              </label>

              <div className="admin-sales-form-actions">
                <button
                  type="submit"
                  className="admin-sales-primary-btn"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
                </button>

                <button
                  type="button"
                  className="admin-sales-secondary-btn"
                  onClick={resetForm}
                >
                  Clear Form
                </button>
              </div>

              {message ? <p className="admin-sales-message">{message}</p> : null}
            </form>
          </div>

          <div className="admin-sales-boards-grid">
            {renderTop10Card("Previous Day", previousDayTop10, "previous_day_sales")}
            {renderTop10Card("Current Month", monthTop10, "month_sales")}
            {renderTop10Card("Current Quarter", quarterTop10, "quarter_sales")}
          </div>
        </section>

        <section className="admin-sales-entries-card">
          <div className="admin-sales-card-head">
            <div>
              <p className="admin-sales-card-kicker">History</p>
              <h3>Sales Entries</h3>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="admin-sales-empty">No sales entries yet.</div>
          ) : (
            <div className="admin-sales-entry-list">
              {entries.map((entry) => (
                <div className="admin-sales-entry-item" key={entry.id}>
                  <div>
                    <h4>{entry.agent_name}</h4>
                    <p>{entry.sales_date}</p>
                  </div>

                  <div className="admin-sales-entry-right">
                    <strong>{entry.sales_count}</strong>
                    <div className="admin-sales-entry-actions">
                      <button
                        className="admin-sales-small-btn"
                        onClick={() => handleEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        className="admin-sales-small-btn danger"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
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