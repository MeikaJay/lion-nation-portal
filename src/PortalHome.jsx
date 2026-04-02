import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalHome.css";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function formatScore(sales, conversion) {
  const salesDisplay = `${sales || 0}MMs`;
  const convDisplay = `${Number(conversion || 0).toFixed(0)}% Conv.`;
  return `${salesDisplay} ${convDisplay}`;
}

export default function PortalHome() {
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Lion");
  const [loading, setLoading] = useState(true);

  const [announcementTitle, setAnnouncementTitle] = useState("Need to Know");
  const [announcementBody, setAnnouncementBody] = useState("");

  const [salesRows, setSalesRows] = useState([]);

  const [clueId, setClueId] = useState(null);
  const [clueDate] = useState(getToday());
  const [clueTitle, setClueTitle] = useState("");
  const [clueText, setClueText] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);

  const [guess, setGuess] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [wheelUnlocked, setWheelUnlocked] = useState(false);
  const [wheelUsed, setWheelUsed] = useState(false);

  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const [guessMessage, setGuessMessage] = useState("");
  const [prizeResult, setPrizeResult] = useState("");

  const [todayWinnerName, setTodayWinnerName] = useState("");
  const [todayWinnerPrize, setTodayWinnerPrize] = useState("");
  const [firstCorrectName, setFirstCorrectName] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  const monthTop5 = useMemo(() => {
    return [...salesRows]
      .filter((row) => row.month_sales > 0)
      .sort((a, b) => {
        const salesDiff = (b.month_sales || 0) - (a.month_sales || 0);
        if (salesDiff !== 0) return salesDiff;

        const conversionDiff =
          (b.month_conversion || 0) - (a.month_conversion || 0);
        if (conversionDiff !== 0) return conversionDiff;

        return a.agent_name.localeCompare(b.agent_name);
      })
      .slice(0, 5);
  }, [salesRows]);

  useEffect(() => {
    const loadPortalData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const email = user.email || "";
      setUserEmail(email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setUserName(profile.full_name.trim().split(" ")[0]);
      } else {
        const emailFirstPart = email.split("@")[0].split(".")[0] || "Lion";
        const formattedFirstName =
          emailFirstPart.charAt(0).toUpperCase() +
          emailFirstPart.slice(1).toLowerCase();

        setUserName(formattedFirstName);
      }

      const { data: announcementData } = await supabase
        .from("portal_announcements")
        .select("title, body")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (announcementData) {
        setAnnouncementTitle(announcementData.title || "Need to Know");
        setAnnouncementBody(announcementData.body || "");
      }

      const { data: salesData } = await supabase
        .from("portal_sales_leaderboard_view")
        .select("*");

      setSalesRows(salesData || []);

      setLoading(false);
    };

    loadPortalData();
  }, [navigate, clueDate]);

  if (loading) {
    return <div className="portal-loading">Loading portal...</div>;
  }

  return (
    <div className="portal-shell">
      <main className="portal-content">
        <section className="portal-grid">
          <article className="portal-card portal-home-card">
            <div className="portal-card-head">
              <p className="portal-card-kicker">Top Performers</p>
              <h3>Top 5 Agents of the Month</h3>
            </div>

            <div className="portal-top10-list">
              {monthTop5.length === 0 ? (
                <div className="portal-empty-state">
                  No monthly sales posted yet.
                </div>
              ) : (
                monthTop5.map((row, index) => (
                  <div
                    className="portal-top10-item"
                    key={`${row.agent_name}-${index}`}
                  >
                    <div className="portal-top10-left">
                      <span className="portal-top10-rank">
                        #{index + 1}
                      </span>
                      <span className="portal-top10-name">
                        {row.agent_name}
                      </span>
                    </div>

                    <span className="portal-top10-score">
                      {formatScore(row.month_sales, row.month_conversion)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}