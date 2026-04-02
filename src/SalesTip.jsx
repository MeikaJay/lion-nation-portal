import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./SalesTip.css";

function SalesTip() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [profile, setProfile] = useState(null);
  const [salesTip, setSalesTip] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSalesTip = async () => {
      try {
        setLoading(true);
        setPageError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate("/");
          return;
        }

        const [profileResult, tipResult] = await Promise.allSettled([
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("sales_tips")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (profileResult.status === "fulfilled" && !profileResult.value.error) {
          setProfile(profileResult.value.data || null);
        }

        if (tipResult.status === "fulfilled" && !tipResult.value.error) {
          setSalesTip(tipResult.value.data || null);
        } else {
          setSalesTip(null);
        }
      } catch (error) {
        console.error("Sales Tip page error:", error);
        if (isMounted) {
          setPageError("Unable to load Sales Tip right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSalesTip();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const tipBullets = normalizeTipBullets(salesTip?.tip_points);

  if (loading) {
    return <div className="sales-tip-loading">Loading sales tip...</div>;
  }

  return (
    <div className="sales-tip-shell">
      <aside className="sales-tip-sidebar">
        <div className="sales-tip-sidebar-top">
          <div className="sales-tip-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="sales-tip-logo"
            />
            <div>
              <p className="sales-tip-kicker">Lion Nation Portal</p>
              <h2>{profile?.full_name?.split(" ")[0] || "Lion"}</h2>
            </div>
          </div>
        </div>

        <nav className="sales-tip-nav">
          <button className="sales-tip-nav-btn" onClick={() => navigate("/portal")}>
            Dashboard
          </button>
          <button
            className="sales-tip-nav-btn"
            onClick={() => navigate("/portal/videos")}
          >
            Video Message
          </button>
          <button
            className="sales-tip-nav-btn"
            onClick={() => navigate("/portal/sales")}
          >
            Top 10 Sales
          </button>
          <button
            className="sales-tip-nav-btn"
            onClick={() => navigate("/portal/bingo")}
          >
            Blackout Bingo
          </button>
          <button
            className="sales-tip-nav-btn"
            onClick={() => navigate("/portal/weekly-focus")}
          >
            Weekly Focus
          </button>
          <button
            className="sales-tip-nav-btn active"
            onClick={() => navigate("/portal/sales-tip")}
          >
            Sales Tip
          </button>
        </nav>

        <button className="sales-tip-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="sales-tip-content">
        <div className="sales-tip-page-head">
          <div>
            <p className="sales-tip-kicker">Coaching Corner</p>
            <h1>Sales Tip</h1>
            <p className="sales-tip-subtitle">
              A quick reminder to help sharpen your approach and strengthen your conversations.
            </p>
          </div>
        </div>

        {pageError ? <div className="sales-tip-alert">{pageError}</div> : null}

        <section className="sales-tip-card">
          {!salesTip ? (
            <div className="sales-tip-empty">
              <h3>No Sales Tip Posted Yet</h3>
              <p>
                There is no active sales tip right now. Once leadership posts one,
                it will show here.
              </p>
            </div>
          ) : (
            <>
              <div className="sales-tip-badge-row">
                <span className="sales-tip-badge">
                  {salesTip.tip_label || "This Week's Tip"}
                </span>
              </div>

              <div className="sales-tip-section">
                <span className="sales-tip-label">Focus</span>
                <h3 className="sales-tip-title">
                  {salesTip.tip_title || "No tip title"}
                </h3>
              </div>

              <div className="sales-tip-section">
                <span className="sales-tip-label">Why It Matters</span>
                <div className="sales-tip-box">
                  <p>
                    {salesTip.tip_message ||
                      "No tip message has been added yet."}
                  </p>
                </div>
              </div>

              <div className="sales-tip-section">
                <span className="sales-tip-label">How To Apply It</span>

                {tipBullets.length > 0 ? (
                  <ul className="sales-tip-list">
                    {tipBullets.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="sales-tip-box">
                    <p>No tip steps have been added yet.</p>
                  </div>
                )}
              </div>

              <div className="sales-tip-footer-row">
                <Link to="/portal" className="sales-tip-link-btn">
                  Back to Dashboard
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function normalizeTipBullets(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.replace(/^[-•*\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

export default SalesTip;