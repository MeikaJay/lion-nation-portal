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

      // Announcement
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

      // Sales
      const { data: salesData } = await supabase
        .from("portal_sales_leaderboard_view")
        .select("*");

      setSalesRows(salesData || []);

      // Clue
      const { data: clueData } = await supabase
        .from("clues")
        .select("id, clue_title, clue_text")
        .eq("clue_date", clueDate)
        .eq("is_active", true)
        .maybeSingle();

      if (clueData) {
        setClueId(clueData.id);
        setClueTitle(clueData.clue_title || "Daily Clue");
        setClueText(clueData.clue_text || "");

        // Pull max attempts from DB safely
        const { data: attemptsConfig } = await supabase
          .from("clues")
          .select("max_attempts")
          .eq("id", clueData.id)
          .maybeSingle();

        const max = attemptsConfig?.max_attempts || 3;
        setMaxAttempts(max);

        const { count } = await supabase
          .from("clue_attempts")
          .select("*", { count: "exact", head: true })
          .eq("clue_id", clueData.id)
          .eq("profile_id", user.id);

        const usedAttempts = count || 0;
        setRemainingAttempts(Math.max(max - usedAttempts, 0));

        const { data: unlockData } = await supabase
          .from("clue_unlocks")
          .select("wheel_used")
          .eq("clue_id", clueData.id)
          .eq("profile_id", user.id)
          .maybeSingle();

        if (unlockData) {
          setWheelUnlocked(true);
          setWheelUsed(Boolean(unlockData.wheel_used));
        }
      }

      // Status (THIS is where answer comes from)
      const { data: todayData } = await supabase.rpc("get_today_game_status");

      if (todayData?.has_clue) {
        setTodayWinnerName(todayData.latest_winner_name || "");
        setTodayWinnerPrize(todayData.latest_winner_prize || "");
        setFirstCorrectName(todayData.first_correct_name || "");

        // SAFE FALLBACK
        setCorrectAnswer(
          todayData.correct_answer || todayData.answer_text || ""
        );
      }

      setLoading(false);
    };

    loadPortalData();
  }, [navigate, clueDate]);

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

    const { data, error } = await supabase.rpc("submit_clue_guess", {
      p_clue_date: clueDate,
      p_guess: guess,
    });

    if (error) {
      setGuessMessage(`Guess failed: ${error.message}`);
      setSubmittingGuess(false);
      return;
    }

    if (data?.message) setGuessMessage(data.message);
    if (typeof data?.remaining_attempts === "number") {
      setRemainingAttempts(data.remaining_attempts);
    }

    if (data?.unlocked) {
      setWheelUnlocked(true);
      setWheelUsed(false);
    }

    setGuess("");
    setSubmittingGuess(false);
  };

  if (loading) {
    return <div className="portal-loading">Loading portal...</div>;
  }

  return (
    <div className="portal-shell">
      <main className="portal-content">
        <section className="portal-featured">
          <article className="portal-featured-card">
            <h2>{clueTitle || "Daily Clue"}</h2>

            <p>{clueText || "No clue posted yet."}</p>

            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Enter your guess"
            />

            <button onClick={handleSubmitGuess}>
              {submittingGuess ? "Checking..." : "Submit Guess"}
            </button>

            <p>
              Attempts: {remainingAttempts}/{maxAttempts}
            </p>

            {guessMessage && <p>{guessMessage}</p>}
          </article>
        </section>
      </main>
    </div>
  );
}