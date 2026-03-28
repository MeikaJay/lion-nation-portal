import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminPrizeManagement.css";

const emptyForm = {
  title: "",
  description: "",
  display_order: 0,
  quantity_available: "",
  is_active: true,
};

export default function AdminPrizeManagement() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prizes, setPrizes] = useState([]);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("Admin");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  const filteredPrizes = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return prizes;

    return prizes.filter((prize) => {
      const title = prize.title?.toLowerCase() || "";
      const description = prize.description?.toLowerCase() || "";
      return title.includes(term) || description.includes(term);
    });
  }, [prizes, search]);

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

    const role = profile?.role || "agent";

    if (role !== "admin" && role !== "leader") {
      navigate("/portal");
      return;
    }

    if (profile?.full_name) {
      setUserName(profile.full_name.trim().split(" ")[0]);
    }

    const { data, error } = await supabase
      .from("portal_prizes")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Could not load prizes: ${error.message}`);
    } else {
      setPrizes(data || []);
    }

    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      display_order: Number(form.display_order) || 0,
      quantity_available:
        form.quantity_available === ""
          ? null
          : Number(form.quantity_available),
      is_active: Boolean(form.is_active),
    };

    if (!payload.title) {
      setMessage("Prize name is required.");
      setSaving(false);
      return;
    }

    let error;

    if (editingId) {
      const response = await supabase
        .from("portal_prizes")
        .update(payload)
        .eq("id", editingId);

      error = response.error;
    } else {
      const response = await supabase.from("portal_prizes").insert(payload);
      error = response.error;
    }

    if (error) {
      setMessage(`Could not save prize: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage(editingId ? "Prize updated successfully." : "Prize added successfully.");
    resetForm();
    await loadPage();
    setSaving(false);
  }

  function handleEdit(prize) {
    setEditingId(prize.id);
    setForm({
      title: prize.title || "",
      description: prize.description || "",
      display_order: prize.display_order ?? 0,
      quantity_available:
        prize.quantity_available === null || prize.quantity_available === undefined
          ? ""
          : prize.quantity_available,
      is_active: Boolean(prize.is_active),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Delete this prize from the admin list?"
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("portal_prizes")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`Could not delete prize: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Prize deleted successfully.");
    await loadPage();
  }

  async function handleQuickToggle(prize) {
    setMessage("");

    const { error } = await supabase
      .from("portal_prizes")
      .update({ is_active: !prize.is_active })
      .eq("id", prize.id);

    if (error) {
      setMessage(`Could not update prize: ${error.message}`);
      return;
    }

    await loadPage();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return <div className="admin-prizes-loading">Loading prize management...</div>;
  }

  return (
    <div className="admin-prizes-page">
      <header className="admin-prizes-header">
        <div className="admin-prizes-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="admin-prizes-logo"
          />
          <div>
            <p className="admin-prizes-mini-title">Lion Nation Admin</p>
            <h1>Prize Management</h1>
            <p className="admin-prizes-subtitle">
              Welcome, {userName}. Control the prizes agents can win.
            </p>
          </div>
        </div>

        <div className="admin-prizes-header-actions">
          <button
            className="admin-prizes-secondary-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
          <button
            className="admin-prizes-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="admin-prizes-main">
        <section className="admin-prizes-hero">
          <div>
            <p className="admin-prizes-tag">Rewards Control</p>
            <h2>Manage your prize list from admin</h2>
            <p>
              Add prizes, reorder them, activate or deactivate them, and keep
              your reward list clean without changing code.
            </p>
          </div>
        </section>

        <section className="admin-prizes-layout">
          <div className="admin-prizes-form-card">
            <div className="admin-prizes-card-head">
              <div>
                <p className="admin-prizes-card-kicker">Editor</p>
                <h3>{editingId ? "Edit Prize" : "Add Prize"}</h3>
              </div>
            </div>

            <form className="admin-prizes-form" onSubmit={handleSave}>
              <label>
                Prize Name
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Example: Gift Card"
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Optional short description for admin tracking"
                />
              </label>

              <div className="admin-prizes-form-row">
                <label>
                  Display Order
                  <input
                    type="number"
                    name="display_order"
                    value={form.display_order}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </label>

                <label>
                  Quantity Available
                  <input
                    type="number"
                    name="quantity_available"
                    value={form.quantity_available}
                    onChange={handleChange}
                    placeholder="Leave blank for unlimited"
                  />
                </label>
              </div>

              <label className="admin-prizes-checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
                Active and available to agents
              </label>

              <div className="admin-prizes-form-actions">
                <button
                  type="submit"
                  className="admin-prizes-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? editingId
                      ? "Updating..."
                      : "Saving..."
                    : editingId
                    ? "Update Prize"
                    : "Save Prize"}
                </button>

                <button
                  type="button"
                  className="admin-prizes-secondary-btn"
                  onClick={resetForm}
                >
                  Clear Form
                </button>
              </div>

              {message ? <p className="admin-prizes-message">{message}</p> : null}
            </form>
          </div>

          <div className="admin-prizes-list-card">
            <div className="admin-prizes-card-head admin-prizes-list-head">
              <div>
                <p className="admin-prizes-card-kicker">Prize List</p>
                <h3>Current Prizes</h3>
              </div>

              <input
                type="text"
                className="admin-prizes-search"
                placeholder="Search prizes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filteredPrizes.length === 0 ? (
              <div className="admin-prizes-empty">
                No prizes found yet.
              </div>
            ) : (
              <div className="admin-prizes-list">
                {filteredPrizes.map((prize) => (
                  <div className="admin-prizes-item" key={prize.id}>
                    <div className="admin-prizes-item-top">
                      <div>
                        <div className="admin-prizes-title-row">
                          <h4>{prize.title}</h4>
                          <span
                            className={`admin-prizes-status ${
                              prize.is_active ? "active" : "inactive"
                            }`}
                          >
                            {prize.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <p className="admin-prizes-description">
                          {prize.description || "No description added."}
                        </p>
                      </div>
                    </div>

                    <div className="admin-prizes-meta">
                      <span>Order: {prize.display_order ?? 0}</span>
                      <span>
                        Quantity:{" "}
                        {prize.quantity_available === null
                          ? "Unlimited"
                          : prize.quantity_available}
                      </span>
                    </div>

                    <div className="admin-prizes-item-actions">
                      <button
                        className="admin-prizes-small-btn"
                        onClick={() => handleEdit(prize)}
                      >
                        Edit
                      </button>

                      <button
                        className="admin-prizes-small-btn"
                        onClick={() => handleQuickToggle(prize)}
                      >
                        {prize.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        className="admin-prizes-small-btn danger"
                        onClick={() => handleDelete(prize.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}