import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminPortalContent.css";

export default function AdminPortalContent() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("Admin");

  const [announcementId, setAnnouncementId] = useState(null);
  const [title, setTitle] = useState("Announcements");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

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

    const { data: activeAnnouncement, error } = await supabase
      .from("portal_announcements")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(`Could not load announcement: ${error.message}`);
    }

    if (activeAnnouncement) {
      setAnnouncementId(activeAnnouncement.id);
      setTitle(activeAnnouncement.title || "Announcements");
      setBody(activeAnnouncement.body || "");
      setIsActive(Boolean(activeAnnouncement.is_active));
    } else {
      setAnnouncementId(null);
      setTitle("Announcements");
      setBody("");
      setIsActive(true);
    }

    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const cleanTitle = title.trim() || "Announcements";
    const cleanBody = body.trim();

    if (!cleanBody) {
      setMessage("Please enter an announcement message.");
      setSaving(false);
      return;
    }

    if (isActive) {
      const { error: deactivateError } = await supabase
        .from("portal_announcements")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        setMessage(`Could not update current announcement: ${deactivateError.message}`);
        setSaving(false);
        return;
      }
    }

    let error;

    if (announcementId) {
      const response = await supabase
        .from("portal_announcements")
        .update({
          title: cleanTitle,
          body: cleanBody,
          is_active: isActive,
        })
        .eq("id", announcementId);

      error = response.error;
    } else {
      const response = await supabase
        .from("portal_announcements")
        .insert({
          title: cleanTitle,
          body: cleanBody,
          is_active: isActive,
        });

      error = response.error;
    }

    if (error) {
      setMessage(`Could not save announcement: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Announcement saved successfully.");
    await loadPage();
    setSaving(false);
  }

  async function handleDeactivateCurrent() {
    setMessage("");

    if (!announcementId) {
      setMessage("There is no active announcement to deactivate.");
      return;
    }

    const { error } = await supabase
      .from("portal_announcements")
      .update({ is_active: false })
      .eq("id", announcementId);

    if (error) {
      setMessage(`Could not deactivate announcement: ${error.message}`);
      return;
    }

    setAnnouncementId(null);
    setTitle("Announcements");
    setBody("");
    setIsActive(true);
    setMessage("Announcement removed from the portal home page.");
  }

  function handleClear() {
    setAnnouncementId(null);
    setTitle("Announcements");
    setBody("");
    setIsActive(true);
    setMessage("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return <div className="admin-content-loading">Loading portal content...</div>;
  }

  return (
    <div className="admin-content-page">
      <header className="admin-content-header">
        <div className="admin-content-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="admin-content-logo"
          />
          <div>
            <p className="admin-content-mini-title">Lion Nation Admin</p>
            <h1>Portal Content</h1>
            <p className="admin-content-subtitle">
              Welcome, {userName}. Control what agents see first.
            </p>
          </div>
        </div>

        <div className="admin-content-header-actions">
          <button
            className="admin-content-secondary-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
          <button
            className="admin-content-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="admin-content-main">
        <section className="admin-content-hero">
          <p className="admin-content-tag">Homepage Control</p>
          <h2>Manage the portal announcement agents see right away</h2>
          <p>
            This message appears on the main portal page so agents do not have to
            click into another page to see it.
          </p>
        </section>

        <section className="admin-content-layout">
          <div className="admin-content-form-card">
            <div className="admin-content-card-head">
              <div>
                <p className="admin-content-card-kicker">Editor</p>
                <h3>Announcements</h3>
              </div>
            </div>

            <form className="admin-content-form" onSubmit={handleSave}>
              <label>
                Section Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcements"
                />
              </label>

              <label>
                Message
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type the important message agents should see as soon as they log in..."
                />
              </label>

              <label className="admin-content-checkbox">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Show this announcement on the portal homepage
              </label>

              <div className="admin-content-form-actions">
                <button
                  type="submit"
                  className="admin-content-primary-btn"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Announcement"}
                </button>

                <button
                  type="button"
                  className="admin-content-secondary-btn"
                  onClick={handleClear}
                >
                  Clear Form
                </button>

                <button
                  type="button"
                  className="admin-content-secondary-btn danger"
                  onClick={handleDeactivateCurrent}
                >
                  Remove From Homepage
                </button>
              </div>

              {message ? <p className="admin-content-message">{message}</p> : null}
            </form>
          </div>

          <div className="admin-content-preview-card">
            <div className="admin-content-card-head">
              <div>
                <p className="admin-content-card-kicker">Preview</p>
                <h3>What agents will see</h3>
              </div>
            </div>

            <div className="announcement-preview">
              <p className="announcement-preview-label">
                {title.trim() || "Announcements"}
              </p>
              <h4>Important update for the team</h4>
              <p className="announcement-preview-body">
                {body.trim() || "Your announcement preview will appear here."}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}