import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalVideos.css";

export default function PortalVideos() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState(null);
  const [olderVideos, setOlderVideos] = useState([]);
  const [comments, setComments] = useState([]);
  const [likesCount, setLikesCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("Lion");
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setMessage(`Could not load user: ${userError.message}`);
        setLoading(false);
        return;
      }

      if (!user) {
        navigate("/");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const realName =
        myProfile?.full_name ||
        (user.email
          ? user.email.split("@")[0].split(".")[0]
          : "Lion Nation Agent");

      setUserName(realName);

      const { data: featuredVideo } = await supabase
        .from("portal_videos")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let finalVideo = featuredVideo || null;

      if (!finalVideo) {
        const { data: fallbackVideo, error: fallbackError } = await supabase
          .from("portal_videos")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackError) {
          setMessage(`Could not load video: ${fallbackError.message}`);
          setLoading(false);
          return;
        }

        finalVideo = fallbackVideo || null;
      }

      setVideo(finalVideo);

      if (!finalVideo) {
        setOlderVideos([]);
        setComments([]);
        setLikesCount(0);
        setUserLiked(false);
        setLoading(false);
        return;
      }

      const { data: archiveData } = await supabase
        .from("portal_videos")
        .select("*")
        .eq("is_active", true)
        .neq("id", finalVideo.id)
        .order("created_at", { ascending: false });

      setOlderVideos(archiveData || []);

      const { count: likeCount } = await supabase
        .from("portal_video_likes")
        .select("*", { count: "exact", head: true })
        .eq("video_id", finalVideo.id);

      setLikesCount(likeCount || 0);

      const { data: myLike } = await supabase
        .from("portal_video_likes")
        .select("id")
        .eq("video_id", finalVideo.id)
        .eq("profile_id", user.id)
        .maybeSingle();

      setUserLiked(Boolean(myLike));

      const { data: commentsData } = await supabase
        .from("portal_video_comments")
        .select("id, comment_text, created_at, profile_id, commenter_name")
        .eq("video_id", finalVideo.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      setComments(commentsData || []);
    } catch (err) {
      setMessage(`Something went wrong loading the video page: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleLike() {
    if (!video || !currentUserId) return;

    setTogglingLike(true);
    setMessage("");

    try {
      if (userLiked) {
        const { error } = await supabase
          .from("portal_video_likes")
          .delete()
          .eq("video_id", video.id)
          .eq("profile_id", currentUserId);

        if (error) {
          setMessage(`Could not remove like: ${error.message}`);
          setTogglingLike(false);
          return;
        }

        setUserLiked(false);
        setLikesCount((prev) => Math.max(prev - 1, 0));
      } else {
        const { error } = await supabase
          .from("portal_video_likes")
          .insert({
            video_id: video.id,
            profile_id: currentUserId,
          });

        if (error) {
          setMessage(`Could not like video: ${error.message}`);
          setTogglingLike(false);
          return;
        }

        setUserLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (err) {
      setMessage(`Like action failed: ${err.message}`);
    } finally {
      setTogglingLike(false);
    }
  }

  async function handlePostComment() {
    if (!video || !currentUserId) return;

    const cleanComment = commentText.trim();

    if (!cleanComment) {
      setMessage("Please enter a comment first.");
      return;
    }

    setPostingComment(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("portal_video_comments")
        .insert({
          video_id: video.id,
          profile_id: currentUserId,
          commenter_name: userName,
          comment_text: cleanComment,
        });

      if (error) {
        setMessage(`Could not post comment: ${error.message}`);
        setPostingComment(false);
        return;
      }

      setCommentText("");
      await loadPage();
    } catch (err) {
      setMessage(`Comment failed: ${err.message}`);
    } finally {
      setPostingComment(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  if (loading) {
    return <div className="portal-videos-loading">Loading video message...</div>;
  }

  return (
    <div className="portal-videos-page">
      <header className="portal-videos-header">
        <div className="portal-videos-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
            className="portal-videos-logo"
          />
          <div>
            <p className="portal-videos-mini-title">Lion Nation Portal</p>
            <h1>Lion Nation Video Message</h1>
            <p className="portal-videos-subtitle">
              Welcome, {userName}. Watch, like, and join the conversation.
            </p>
          </div>
        </div>

        <div className="portal-videos-header-actions">
          <button
            className="portal-videos-secondary-btn"
            onClick={() => navigate("/portal")}
          >
            Back to Portal
          </button>
          <button
            className="portal-videos-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="portal-videos-main">
        {message ? <p className="portal-videos-message">{message}</p> : null}

        {!video ? (
          <section className="portal-videos-empty-card">
            <p className="portal-videos-empty-label">No video posted yet</p>
            <h2>Check back soon for the next Lion Nation Video Message</h2>
          </section>
        ) : (
          <>
            <section className="portal-videos-featured-card">
              <p className="portal-videos-tag">Featured Video</p>
              <h2>{video.title}</h2>
              <p className="portal-videos-date">Posted {formatDate(video.created_at)}</p>

              <video
                className="portal-videos-player"
                controls
                preload="metadata"
                playsInline
              >
                <source src={video.video_url} type="video/mp4" />
                Your browser does not support video playback.
              </video>

              <p className="portal-videos-caption">
                {video.caption || "No caption added."}
              </p>

              <div className="portal-videos-actions">
                <button
                  className={`portal-videos-like-btn ${userLiked ? "liked" : ""}`}
                  onClick={handleToggleLike}
                  disabled={togglingLike}
                >
                  {userLiked ? "Liked" : "Like"} ({likesCount})
                </button>
              </div>
            </section>

            <section className="portal-videos-comments-card">
              <div className="portal-videos-section-head">
                <div>
                  <p className="portal-videos-section-kicker">Comments</p>
                  <h3>Join the conversation</h3>
                </div>
              </div>

              <div className="portal-videos-comment-form">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Leave a comment..."
                />
                <button
                  className="portal-videos-post-btn"
                  onClick={handlePostComment}
                  disabled={postingComment}
                >
                  {postingComment ? "Posting..." : "Post Comment"}
                </button>
              </div>

              {comments.length === 0 ? (
                <div className="portal-videos-empty-comments">
                  No comments yet. Be the first to say something.
                </div>
              ) : (
                <div className="portal-videos-comments-list">
                  {comments.map((comment) => (
                    <div className="portal-videos-comment-item" key={comment.id}>
                      <div className="portal-videos-comment-top">
                        <h4>{comment.commenter_name || "Lion Nation Agent"}</h4>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>
                      <p>{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="portal-videos-archive-card">
              <div className="portal-videos-section-head">
                <div>
                  <p className="portal-videos-section-kicker">More Videos</p>
                  <h3>Previous Video Messages</h3>
                </div>
              </div>

              {olderVideos.length === 0 ? (
                <div className="portal-videos-empty-comments">
                  No previous videos yet.
                </div>
              ) : (
                <div className="portal-videos-archive-list">
                  {olderVideos.map((item) => (
                    <div className="portal-videos-archive-item" key={item.id}>
                      <h4>{item.title}</h4>
                      <p>{item.caption || "No caption added."}</p>
                      <span>Posted {formatDate(item.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}