import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalHome.css";

function getToday() {
  return new Date().toISOString().split("T")[0];
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

  const monthTop10 = useMemo(() => {
    return [...salesRows]
      .sort(
        (a, b) =>
          b.month_sales - a.month_sales || a.agent_name.localeCompare(b.agent_name)
      )
      .filter((row) => row.month_sales > 0)
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

      const { data: clueData, error: clueError } = await supabase
        .from("clues")
        .select("id, clue_title, clue_text, max_attempts")
        .eq("clue_date", clueDate)
        .eq("is_active", true)
        .maybeSingle();

      if (clueError) {
        console.log("Clue lookup issue:", clueError.message);
      }

      if (clueData) {
        setClueId(clueData.id);
        setClueTitle(clueData.clue_title || "Daily Clue");
        setClueText(clueData.clue_text || "");
        setMaxAttempts(clueData.max_attempts || 3);

        const { count } = await supabase
          .from("clue_attempts")
          .select("*", { count: "exact", head: true })
          .eq("clue_id", clueData.id)
          .eq("profile_id", user.id);

        const usedAttempts = count || 0;
        setRemainingAttempts(
          Math.max((clueData.max_attempts || 3) - usedAttempts, 0)
        );

        const { data: unlockData } = await supabase
          .from("clue_unlocks")
          .select("wheel_used")
          .eq("clue_id", clueData.id)
          .eq("profile_id", user.id)
          .maybeSingle();

        if (unlockData) {
          setWheelUnlocked(true);
          setWheelUsed(Boolean(unlockData.wheel_used));

          if (unlockData.wheel_used) {
            setGuessMessage("You already solved today’s clue and used your spin.");

            const { data: prizeData } = await supabase
              .from("prize_results")
              .select("prize_label")
              .eq("clue_id", clueData.id)
              .eq("profile_id", user.id)
              .order("won_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (prizeData?.prize_label) {
              setPrizeResult(prizeData.prize_label);
            }
          } else {
            setGuessMessage("You already solved today’s clue. Your wheel is unlocked.");
          }
        }
      }

      const { data: todayData, error: todayError } = await supabase.rpc(
        "get_today_game_status"
      );

      if (todayError) {
        console.log("Today status issue:", todayError.message);
      } else if (todayData?.has_clue) {
        setTodayWinnerName(todayData.latest_winner_name || "");
        setTodayWinnerPrize(todayData.latest_winner_prize || "");
        setFirstCorrectName(todayData.first_correct_name || "");
        setCorrectAnswer(todayData.correct_answer || "");
      }

      setLoading(false);
    };

    loadPortalData();
  }, [navigate, clueDate]);

  const refreshTodayStatus = async () => {
    const { data } = await supabase.rpc("get_today_game_status");

    if (data?.has_clue) {
      setTodayWinnerName(data.latest_winner_name || "");
      setTodayWinnerPrize(data.latest_winner_prize || "");
      setFirstCorrectName(data.first_correct_name || "");
      setCorrectAnswer(data.correct_answer || "");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSubmitGuess = async () => {
    if (!clueId) {
      setGuessMessage("No clue has been posted for today yet.");
      return;
    }

    if (!guess.trim()) {
      setGuessMessage("Enter a guess first.");
      return;
    }

    if (wheelUnlocked) {
      setGuessMessage(
        wheelUsed
          ? "You already solved today’s clue and used your spin."
          : "You already solved today’s clue. Your wheel is unlocked."
      );
      return;
    }

    if (remainingAttempts <= 0) {
      setGuessMessage("Your chances are up for today.");
      return;
    }

    setSubmittingGuess(true);
    setGuessMessage("");
    setPrizeResult("");

    const { data, error } = await supabase.rpc("submit_clue_guess", {
      p_clue_date: clueDate,
      p_guess: guess,
    });

    if (error) {
      setGuessMessage(`Guess failed: ${error.message}`);
      setSubmittingGuess(false);
      return;
    }

    if (data?.message) {
      setGuessMessage(data.message);
    }

    if (typeof data?.remaining_attempts === "number") {
      setRemainingAttempts(data.remaining_attempts);
    }

    if (data?.unlocked) {
      setWheelUnlocked(true);
      setWheelUsed(false);
      await refreshTodayStatus();
    }

    setGuess("");
    setSubmittingGuess(false);
  };

  const handleSpin = async () => {
    if (!wheelUnlocked) {
      setGuessMessage("You need to solve the clue first.");
      return;
    }

    if (wheelUsed) {
      setGuessMessage("You already used your spin.");
      return;
    }

    setSpinning(true);
    setGuessMessage("");
    setPrizeResult("");

    const { data, error } = await supabase.rpc("spin_prize_wheel", {
      p_clue_date: clueDate,
    });

    if (error) {
      setGuessMessage(`Spin failed: ${error.message}`);
      setSpinning(false);
      return;
    }

    if (data?.error) {
      setGuessMessage(data.error);
      setSpinning(false);
      return;
    }

    if (data?.prize_name) {
      setPrizeResult(data.prize_name);
      setWheelUsed(true);
      setGuessMessage("Congratulations! Your prize has been recorded.");
      await refreshTodayStatus();
    } else {
      setGuessMessage("Spin completed, but no prize was returned.");
    }

    setSpinning(false);
  };

  if (loading) {
    return <div className="portal-loading">Loading portal...</div>;
  }

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-top">
          <div className="portal-sidebar-brand">
            <img
              src="/Lion Nation.png"
              alt="Lion Nation"
              className="portal-sidebar-logo"
            />
            <div>
              <p className="portal-sidebar-kicker">Lion Nation Portal</p>
              <h2>{userName}</h2>
            </div>
          </div>

          <div className="portal-sidebar-email">{userEmail}</div>
        </div>

        <nav className="portal-sidebar-nav">
          <button className="portal-nav-btn" onClick={() => navigate("/portal")}>
            Dashboard
          </button>

          <button className="portal-nav-btn" onClick={() => navigate("/portal/videos")}>
            Video Message
          </button>

          <button className="portal-nav-btn" onClick={() => navigate("/portal/sales")}>
            Top 5 Sales
          </button>

          <button className="portal-nav-btn" onClick={() => navigate("/portal/bingo")}>
            Blackout Bingo
          </button>

          <button
            className="portal-nav-btn"
            onClick={() => navigate("/portal/weekly-focus")}
          >
            Weekly Focus
          </button>

          <button
            className="portal-nav-btn"
            onClick={() => navigate("/portal/sales-tip")}
          >
            Sales Tip
          </button>

          <button
            className="portal-nav-btn"
            onClick={() => navigate("/portal/suggestions")}
          >
            Suggestion Box
          </button>
        </nav>

        <button className="portal-sidebar-logout" onClick={handleLogout}>
          Log Out
        </button>
      </aside>

      <main className="portal-content">
        <section className="portal-hero">
          <div className="portal-hero-copy">
            <p className="portal-hero-kicker">Lion Nation</p>
            <h1>Welcome back, {userName}</h1>
            <p className="portal-hero-sub">
              Stay locked in. Stay consistent. Let’s dominate this week.
            </p>
          </div>
        </section>

        <section className="portal-featured">
          <article className="portal-featured-card">
            <div className="portal-featured-head">
              <p className="portal-card-kicker">Featured Challenge: Collect all clues, then try your luck. If you know the answer before the final clue, go for it.</p>
              <h2>{clueTitle || "Daily Clue"}</h2>
            </div>

            <p className="portal-clue-text">
              {clueText || "No clue has been posted for today yet."}
            </p>

            <div className="portal-featured-actions">
              <input
                type="text"
                placeholder="Enter your guess..."
                className="portal-clue-input"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                disabled={!clueText || remainingAttempts <= 0 || wheelUnlocked}
              />

              <button
                className="portal-primary-btn"
                onClick={handleSubmitGuess}
                disabled={
                  !clueText || submittingGuess || remainingAttempts <= 0 || wheelUnlocked
                }
              >
                {submittingGuess ? "Checking..." : "Submit Guess"}
              </button>
            </div>

            <p className="portal-clue-attempts">
              Attempts remaining: {wheelUnlocked ? 0 : remainingAttempts} / {maxAttempts}
            </p>

            {guessMessage ? (
              <p className={`portal-clue-status ${wheelUnlocked ? "success" : ""}`}>
                {guessMessage}
              </p>
            ) : null}

            {wheelUnlocked && !wheelUsed ? (
              <button
                className="portal-primary-btn portal-spin-btn"
                onClick={handleSpin}
                disabled={spinning}
              >
                {spinning ? "Spinning..." : "Claim Prize"}
              </button>
            ) : null}

            {prizeResult ? (
              <div className="portal-prize-card">
                <p className="portal-card-kicker">You Won</p>
                <h3>{prizeResult}</h3>
              </div>
            ) : null}
          </article>
        </section>

        <section className="portal-grid">
          <article className="portal-card portal-home-card">
            <div className="portal-card-head">
              <p className="portal-card-kicker">Need to Know</p>
              <h3>{announcementTitle || "Updates"}</h3>
            </div>

            <div className="portal-card-body">
              <p className="portal-card-message">
                {announcementBody || "No updates have been posted yet."}
              </p>
            </div>
          </article>

          <article className="portal-card portal-home-card">
            <div className="portal-card-head">
              <p className="portal-card-kicker">Top Performers</p>
              <h3>Top 5 Agents of the Month</h3>
            </div>

            <div className="portal-top10-list">
              {monthTop10.length === 0 ? (
                <div className="portal-empty-state">No monthly sales posted yet.</div>
              ) : (
                monthTop10.map((row, index) => (
                  <div className="portal-top10-item" key={`${row.agent_name}-${index}`}>
                    <div className="portal-top10-left">
                      <span className="portal-top10-rank">#{index + 1}</span>
                      <span className="portal-top10-name">{row.agent_name}</span>
                    </div>
                    <span className="portal-top10-score">{row.month_sales}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="portal-card portal-home-card">
            <div className="portal-card-head">
              <p className="portal-card-kicker">Weekly Focus</p>
              <h3>Stay Locked In</h3>
            </div>

            <div className="portal-card-body">
              <p className="portal-card-message">
                Keep the momentum high. Focus on consistency, follow up, and controlling
                your pipeline this week.
              </p>

              <button
                className="portal-secondary-btn"
                onClick={() => navigate("/portal/weekly-focus")}
              >
                View Full Focus
              </button>
            </div>
          </article>
        </section>

        <section className="portal-winners">
          <article className="portal-winner-card">
            <p className="portal-card-kicker">Today’s Winner</p>
            <h3>{todayWinnerName || "No winner yet"}</h3>
            <span>{todayWinnerPrize || "Prize will appear here once someone wins."}</span>
          </article>

          <article className="portal-winner-card">
            <p className="portal-card-kicker">First Correct Guess</p>
            <h3>{firstCorrectName || "No one yet"}</h3>
            <span>{correctAnswer || "The answer will show after the first correct guess."}</span>
          </article>
        </section>
      </main>
    </div>
  );
}