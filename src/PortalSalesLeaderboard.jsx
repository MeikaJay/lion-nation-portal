import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalSalesLeaderboard.css";

function sortBySalesThenConversion(rows, salesKey, conversionKey) {
  return [...rows].sort((a, b) => {
    const salesDiff = (b[salesKey] || 0) - (a[salesKey] || 0);
    if (salesDiff !== 0) return salesDiff;

    const conversionDiff = (b[conversionKey] || 0) - (a[conversionKey] || 0);
    if (conversionDiff !== 0) return conversionDiff;

    return a.agent_name.localeCompare(b.agent_name);
  });
}

function formatSalesAndConversion(sales, conversion) {
  const safeSales = Number(sales || 0);
  const safeConversion = Number(conversion || 0);
  return `${safeSales}MMs ${safeConversion.toFixed(0)}% Conv.`;
}

export default function PortalSalesLeaderboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [userName, setUserName] = useState("Lion");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  const previousDayTop5 = useMemo(() => {
    return sortBySalesThenConversion(
      rows.filter((row) => row.previous_day_sales > 0),
      "previous_day_sales",
      "previous_day_conversion"
    ).slice(0, 5);
  }, [rows]);

  const monthTop5 = useMemo(() => {
    return sortBySalesThenConversion(
      rows.filter((row) => row.month_sales > 0),
      "month_sales",
      "month_conversion"
    ).slice(0, 5);
  }, [rows]);

  const quarterTop5 = useMemo(() => {
    return sortBySalesThenConversion(
      rows.filter((row) => row.quarter_sales > 0),
      "quarter_sales",
      "quarter_conversion"
    ).slice(0, 5);
  }, [rows]);

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
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.full_name) {
      setUserName(profile.full_name.trim().split(" ")[0]);
    } else if (user.email) {
      const firstPart = user.email.split("@")[0].split(".")[0];
      setUserName(firstPart.charAt(0).toUpperCase() + firstPart.slice(1));
    }

    const { data, error } = await supabase
      .from("portal_sales_leaderboard_view")
      .select("*");

    if (error) {
      setMessage(`Could not load sales leaderboard: ${error.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function renderTop5Card(title, rows, salesKey, conversionKey) {
    return (
      <div className="portal-sales-board-card">
        <div className="portal-sales-board-head">
          <p className="portal-sales-board-kicker">Top 5</p>
          <h3>{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className="portal-sales-empty">No sales posted yet.</div>
        ) : (
          <div className="portal-sales-rank-list">
            {rows.map((row, index) => (
              <div className="portal-sales-rank-item" key={`${title}-${row.agent_name}`}>
                <div className="portal-sales-rank-left">
                  <span className="portal-sales-rank-number">#{index + 1}</span>
                  <span className="portal-sales-rank-name">{row.agent_name}</span>
                </div>
                <span className="portal-sales-rank-score">
                  {formatSalesAndConversion(row[salesKey], row[conversionKey])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="portal-sales-loading">Loading sales leaderboard...</div>;
  }

  return (
    <div className="portal-sales-page">
      <header className="portal-sales-header">
        <div className="portal-sales-brand">
          <img src="/Lion Nation.png" alt="Lion Nation" className="portal-sales-logo" />
          <div>
            <p className="portal-sales-mini-title">Lion Nation Portal</p>
            <h1>Top 5 Sales</h1>
            <p className="portal-sales-subtitle">
              Welcome, {userName}. See who is leading the site in sales.
            </p>
          </div>
        </div>

        <div className="portal-sales-header-actions">
          <button
            className="portal-sales-secondary-btn"
            onClick={() => navigate("/portal")}
          >
            Back to Portal
          </button>
          <button
            className="portal-sales-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="portal-sales-main">
        <section className="portal-sales-hero">
          <p className="portal-sales-tag">Sales and Conversion</p>
          <h2>Site Sales Rankings</h2>
          <p>
            This board shows the Top 5 for previous day, current month, and current quarter.
            Sales lead first, and conversion breaks ties.
          </p>
        </section>

        {message ? <p className="portal-sales-message">{message}</p> : null}

        <section className="portal-sales-boards-grid">
          {renderTop5Card(
            "Previous Day",
            previousDayTop5,
            "previous_day_sales",
            "previous_day_conversion"
          )}
          {renderTop5Card(
            "Current Month",
            monthTop5,
            "month_sales",
            "month_conversion"
          )}
          {renderTop5Card(
            "Current Quarter",
            quarterTop5,
            "quarter_sales",
            "quarter_conversion"
          )}
        </section>
      </main>
    </div>
  );
}