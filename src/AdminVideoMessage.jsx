import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminVideoMessage.css";

const emptyForm = {
  title: "",
  caption: "",
  video_url: "",
  is_active: true,
  is_featured: true,
};

export default function AdminVideoMessage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moderating, setModerating] = useState(false);

  const [userName, setUserName] = useState("Admin");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [videos, setVideos] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentFilter, setCommentFilter] = useState("all");
  const [commentSearch, setCommentSearch] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  const filteredComments = useMemo(() => {
    const term = commentSearch.trim().toLowerCase();

    return comments.filter((comment) => {
      const matchesFilter =
        commentFilter === "all"
          ? true
          : commentFilter === "hidden"
          ? comment.is_hidden
          : !comment.is_hidden;

      const videoTitle = comment.video_title?.toLowerCase() || "";
      const commentText = comment.comment_text?.toLowerCase() || "";

      const matchesSearch =
        !term || videoTitle.includes(term) || commentText.includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [comments, commentFilter, commentSearch]);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
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

      if (role !== "admin") {
        navigate("/portal");
        return;
      }

      if (profile?.full_name) {
        setUserName(profile.full_name.trim().split(" ")[0]);
      }

      const { data: videoRows, error: videosError } = await supabase
        .from("portal_videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (videosError) {
        setMessage(`Could not load videos: ${videosError.message}`);
      } else {
        setVideos(videoRows || []);
      }

      const { data: commentRows, error: commentsError } = await supabase
        .from("portal_video_comments")
        .select(`
            id,
            comment_text,
            commenter_name,
            is_hidden,
            created_at,
            video_id,
            portal_videos(title)
          `)
        .order("created_at", { ascending: false });

      if (commentsError) {
        setMessage((prev) =>
          prev
            ? `${prev} Could not load comments: ${commentsError.message}`
            : `Could not load comments: ${commentsError.message}`
        );
      } else {
        const mappedComments = (commentRows || []).map((comment) => ({
            id: comment.id,
            comment_text: comment.comment_text,
            commenter_name: comment.commenter_name || "Lion Nation Agent",
            is_hidden: comment.is_hidden,
            created_at: comment.created_at,
            video_id: comment.video_id,
            video_title: comment.portal_videos?.title || "Unknown Video",
          }));

        setComments(mappedComments);
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setPreviewUrl("");
    setMessage("");
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("Uploading video...");

    const fileExt = file.name.split(".").pop();
    const fileName = `video-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("portal-videos")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      setMessage(`Upload failed: ${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("portal-videos")
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      setMessage("Upload finished, but the video URL could not be created.");
      setUploading(false);
      return;
    }

    setForm((prev) => ({
      ...prev,
      video_url: data.publicUrl,
    }));

    setPreviewUrl(data.publicUrl);
    setMessage("Upload complete. Review your preview, then click Post Video.");
    setUploading(false);
  }

  async function handleSave(e) {
    e.preventDefault();

    const cleanTitle = form.title.trim();
    const cleanCaption = form.caption.trim();
    const cleanUrl = form.video_url.trim();

    if (!cleanTitle) {
      setMessage("Video title is required.");
      return;
    }

    if (!cleanUrl) {
      setMessage("Upload a video first.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (form.is_featured) {
        await supabase
          .from("portal_videos")
          .update({ is_featured: false })
          .eq("is_featured", true);
      }

      const payload = {
        title: cleanTitle,
        caption: cleanCaption || null,
        video_url: cleanUrl,
        is_active: Boolean(form.is_active),
        is_featured: Boolean(form.is_featured),
      };

      let error;

      if (editingId) {
        const response = await supabase
          .from("portal_videos")
          .update(payload)
          .eq("id", editingId);

        error = response.error;
      } else {
        const response = await supabase.from("portal_videos").insert(payload);
        error = response.error;
      }

      if (error) {
        setMessage(`Could not save video: ${error.message}`);
        setSaving(false);
        return;
      }

      setMessage(editingId ? "Video updated successfully." : "Video posted successfully.");
      resetForm();
      await loadPage();
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(video) {
    setEditingId(video.id);
    setForm({
      title: video.title || "",
      caption: video.caption || "",
      video_url: video.video_url || "",
      is_active: Boolean(video.is_active),
      is_featured: Boolean(video.is_featured),
    });
    setPreviewUrl(video.video_url || "");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteVideo(id) {
    const confirmed = window.confirm("Delete this video?");
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("portal_videos")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`Could not delete video: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("Video deleted successfully.");
    await loadPage();
  }

  async function handleSetFeatured(video) {
    setMessage("");

    const { error: clearError } = await supabase
      .from("portal_videos")
      .update({ is_featured: false })
      .eq("is_featured", true);

    if (clearError) {
      setMessage(`Could not clear current featured video: ${clearError.message}`);
      return;
    }

    const { error } = await supabase
      .from("portal_videos")
      .update({ is_featured: true, is_active: true })
      .eq("id", video.id);

    if (error) {
      setMessage(`Could not feature video: ${error.message}`);
      return;
    }

    setMessage("Featured video updated.");
    await loadPage();
  }

  async function handleToggleActive(video) {
    setMessage("");

    const { error } = await supabase
      .from("portal_videos")
      .update({ is_active: !video.is_active })
      .eq("id", video.id);

    if (error) {
      setMessage(`Could not update video: ${error.message}`);
      return;
    }

    await loadPage();
  }

  async function handleToggleHide(comment) {
    setModerating(true);
    setMessage("");

    const { error } = await supabase
      .from("portal_video_comments")
      .update({ is_hidden: !comment.is_hidden })
      .eq("id", comment.id);

    if (error) {
      setMessage(`Could not update comment: ${error.message}`);
      setModerating(false);
      return;
    }

    setMessage(comment.is_hidden ? "Comment unhidden." : "Comment hidden.");
    await loadPage();
    setModerating(false);
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm("Delete this comment permanently?");
    if (!confirmed) return;

    setModerating(true);
    setMessage("");

    const { error } = await supabase
      .from("portal_video_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      setMessage(`Could not delete comment: ${error.message}`);
      setModerating(false);
      return;
    }

    setMessage("Comment deleted.");
    await loadPage();
    setModerating(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const featuredVideo = videos.find((video) => video.is_featured && video.is_active);
  const activeCommentCount = comments.filter((c) => !c.is_hidden).length;
  const hiddenCommentCount = comments.filter((c) => c.is_hidden).length;

  if (loading) {
    return <div className="admin-video-loading">Loading video manager...</div>;
  }

  return (
    <div className="admin-video-page">
      <header className="admin-video-header">
        <div className="admin-video-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="admin-video-logo"
          />
          <div>
            <p className="admin-video-mini-title">Lion Nation Admin</p>
            <h1>Lion Nation Video Message</h1>
            <p className="admin-video-subtitle">
              Welcome, {userName}. Manage videos and moderate engagement.
            </p>
          </div>
        </div>

        <div className="admin-video-header-actions">
          <button
            className="admin-video-secondary-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
          <button
            className="admin-video-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="admin-video-main">
        <section className="admin-video-hero">
          <p className="admin-video-tag">Video Control</p>
          <h2>Post videos, feature the right one, and manage comments in one place</h2>
          <p>
            Upload from your computer, control which video agents see first, and keep
            the conversation clean and professional.
          </p>
        </section>

        <section className="admin-video-layout">
          <div className="admin-video-form-card">
            <div className="admin-video-card-head">
              <div>
                <p className="admin-video-card-kicker">Editor</p>
                <h3>{editingId ? "Edit Video" : "Post New Video"}</h3>
              </div>
            </div>

            <form className="admin-video-form" onSubmit={handleSave}>
              <label>
                Video Title
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Example: Keep Pushing This Week"
                />
              </label>

              <label>
                Caption
                <textarea
                  name="caption"
                  value={form.caption}
                  onChange={handleChange}
                  placeholder="Add a short message for agents..."
                />
              </label>

              <label>
                Upload Video From Computer
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  onChange={handleUpload}
                />
              </label>

              <label>
                Video URL
                <input
                  type="text"
                  name="video_url"
                  value={form.video_url}
                  onChange={handleChange}
                  placeholder="Uploaded file URL will appear here"
                />
              </label>

              <label className="admin-video-checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
                Active and visible to agents
              </label>

              <label className="admin-video-checkbox">
                <input
                  type="checkbox"
                  name="is_featured"
                  checked={form.is_featured}
                  onChange={handleChange}
                />
                Make this the featured video
              </label>

              <div className="admin-video-form-actions">
                <button
                  type="submit"
                  className="admin-video-primary-btn"
                  disabled={uploading || saving}
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                    ? "Saving..."
                    : editingId
                    ? "Update Video"
                    : "Post Video"}
                </button>

                <button
                  type="button"
                  className="admin-video-secondary-btn"
                  onClick={resetForm}
                  disabled={uploading || saving}
                >
                  Clear Form
                </button>
              </div>

              {message ? <p className="admin-video-message">{message}</p> : null}
            </form>
          </div>

          <div className="admin-video-preview-card">
            <div className="admin-video-card-head">
              <div>
                <p className="admin-video-card-kicker">Preview</p>
                <h3>{previewUrl ? "Uploaded Video Preview" : "Featured Right Now"}</h3>
              </div>
            </div>

            {previewUrl ? (
              <div className="admin-video-preview-wrap">
                <video className="admin-video-preview-player" controls src={previewUrl} />
                <p className="admin-video-preview-caption">
                  This is the video currently loaded into the form.
                </p>
              </div>
            ) : featuredVideo ? (
              <div className="admin-video-preview-wrap">
                <video
                  className="admin-video-preview-player"
                  controls
                  src={featuredVideo.video_url}
                />
                <p className="admin-video-preview-caption">
                  {featuredVideo.caption || "No caption added."}
                </p>
              </div>
            ) : (
              <div className="admin-video-empty">
                No featured video is active right now.
              </div>
            )}
          </div>
        </section>

        <section className="admin-video-list-card">
          <div className="admin-video-card-head">
            <div>
              <p className="admin-video-card-kicker">Video Library</p>
              <h3>All Video Messages</h3>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="admin-video-empty">No videos posted yet.</div>
          ) : (
            <div className="admin-video-list">
              {videos.map((video) => (
                <div className="admin-video-item" key={video.id}>
                  <div className="admin-video-title-row">
                    <h4>{video.title}</h4>
                    {video.is_featured ? (
                      <span className="admin-video-status featured">Featured</span>
                    ) : null}
                    {video.is_active ? (
                      <span className="admin-video-status active">Active</span>
                    ) : (
                      <span className="admin-video-status inactive">Inactive</span>
                    )}
                  </div>

                  <p className="admin-video-item-caption">
                    {video.caption || "No caption added."}
                  </p>

                  <div className="admin-video-item-actions">
                    <button
                      className="admin-video-small-btn"
                      onClick={() => handleEdit(video)}
                    >
                      Edit
                    </button>

                    <button
                      className="admin-video-small-btn"
                      onClick={() => handleSetFeatured(video)}
                    >
                      Make Featured
                    </button>

                    <button
                      className="admin-video-small-btn"
                      onClick={() => handleToggleActive(video)}
                    >
                      {video.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      className="admin-video-small-btn danger"
                      onClick={() => handleDeleteVideo(video.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-video-comments-card">
          <div className="admin-video-comments-top">
            <div>
              <p className="admin-video-card-kicker">Moderation</p>
              <h3>Comment Moderation</h3>
            </div>

            <div className="admin-video-comment-stats">
              <div className="admin-video-stat-pill">
                Visible: {activeCommentCount}
              </div>
              <div className="admin-video-stat-pill hidden">
                Hidden: {hiddenCommentCount}
              </div>
            </div>
          </div>

          <div className="admin-video-comment-toolbar">
            <div className="admin-video-comment-filter-group">
              <button
                className={`admin-video-filter-btn ${commentFilter === "all" ? "active" : ""}`}
                onClick={() => setCommentFilter("all")}
                type="button"
              >
                All
              </button>
              <button
                className={`admin-video-filter-btn ${commentFilter === "visible" ? "active" : ""}`}
                onClick={() => setCommentFilter("visible")}
                type="button"
              >
                Visible
              </button>
              <button
                className={`admin-video-filter-btn ${commentFilter === "hidden" ? "active" : ""}`}
                onClick={() => setCommentFilter("hidden")}
                type="button"
              >
                Hidden
              </button>
            </div>

            <input
              type="text"
              className="admin-video-comment-search"
              placeholder="Search comments or video titles..."
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
            />
          </div>

          {filteredComments.length === 0 ? (
            <div className="admin-video-empty">No comments found.</div>
          ) : (
            <div className="admin-video-comment-list">
              {filteredComments.map((comment) => (
                <div className="admin-video-comment-item" key={comment.id}>
                  <div className="admin-video-comment-head">
                    <div>
                      <p className="admin-video-comment-video">{comment.video_title}</p>
                      <h4>{comment.commenter_name}</h4>
                    </div>

                    <div className="admin-video-comment-meta">
                      <span
                        className={`admin-video-comment-status ${
                          comment.is_hidden ? "hidden" : "visible"
                        }`}
                      >
                        {comment.is_hidden ? "Hidden" : "Visible"}
                      </span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="admin-video-comment-text">{comment.comment_text}</p>

                  <div className="admin-video-comment-actions">
                    <button
                      className="admin-video-small-btn"
                      onClick={() => handleToggleHide(comment)}
                      disabled={moderating}
                    >
                      {comment.is_hidden ? "Unhide" : "Hide"}
                    </button>

                    <button
                      className="admin-video-small-btn danger"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={moderating}
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