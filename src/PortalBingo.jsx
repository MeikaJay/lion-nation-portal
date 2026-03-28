import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalBingo.css";

export default function PortalBingo() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [squares, setSquares] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [userName, setUserName] = useState("Lion");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [message, setMessage] = useState("");
  const [savingSquareId, setSavingSquareId] = useState(null);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  const completedCount = useMemo(() => {
    return Object.values(progressMap).filter(Boolean).length;
  }, [progressMap]);

  const isBlackoutComplete =
    board && squares.length > 0 && completedCount === squares.length;

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

    setCurrentUserId(user.id);

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

    const { data: activeBoard, error: boardError } = await supabase
      .from("portal_bingo_boards")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (boardError) {
      setMessage(`Could not load bingo board: ${boardError.message}`);
      setLoading(false);
      return;
    }

    if (!activeBoard) {
      setBoard(null);
      setSquares([]);
      setProgressMap({});
      setWinner(null);
      setLoading(false);
      return;
    }

    setBoard(activeBoard);

    const { data: squareRows, error: squareError } = await supabase
      .from("portal_bingo_squares")
      .select("*")
      .eq("board_id", activeBoard.id)
      .order("square_order", { ascending: true });

    if (squareError) {
      setMessage(`Could not load bingo squares: ${squareError.message}`);
      setLoading(false);
      return;
    }

    const orderedSquares = squareRows || [];
    setSquares(orderedSquares);

    const { data: progressRows, error: progressError } = await supabase
      .from("portal_bingo_progress")
      .select("square_id, is_completed")
      .eq("board_id", activeBoard.id)
      .eq("profile_id", user.id);

    if (progressError) {
      setMessage(`Could not load your bingo progress: ${progressError.message}`);
      setLoading(false);
      return;
    }

    const nextProgressMap = {};
    (progressRows || []).forEach((row) => {
      nextProgressMap[row.square_id] = row.is_completed;
    });
    setProgressMap(nextProgressMap);

    const { data: winnerRows } = await supabase
      .from("portal_bingo_winners_view")
      .select("*")
      .eq("board_id", activeBoard.id)
      .order("finished_at", { ascending: true })
      .limit(1);

    if (winnerRows?.length) {
      setWinner(winnerRows[0]);
    } else {
      setWinner(null);
    }

    setLoading(false);
  }

  async function handleToggleSquare(square) {
    if (!board || !currentUserId) return;

    const isCompleted = Boolean(progressMap[square.id]);
    setSavingSquareId(square.id);
    setMessage("");

    if (isCompleted) {
      const { error } = await supabase.from("portal_bingo_progress").upsert({
        board_id: board.id,
        square_id: square.id,
        profile_id: currentUserId,
        is_completed: false,
        completed_at: null,
      });

      if (error) {
        setMessage(`Could not update square: ${error.message}`);
        setSavingSquareId(null);
        return;
      }

      setProgressMap((prev) => ({
        ...prev,
        [square.id]: false,
      }));
    } else {
      const { error } = await supabase.from("portal_bingo_progress").upsert({
        board_id: board.id,
        square_id: square.id,
        profile_id: currentUserId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`Could not update square: ${error.message}`);
        setSavingSquareId(null);
        return;
      }

      setProgressMap((prev) => ({
        ...prev,
        [square.id]: true,
      }));
    }

    setSavingSquareId(null);
    await loadPage();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
  }

  if (loading) {
    return <div className="portal-bingo-loading">Loading bingo...</div>;
  }

  return (
    <div className="portal-bingo-page">
      <header className="portal-bingo-header">
        <div className="portal-bingo-brand">
          <img src="/Lion Nation.png" alt="Lion Nation" className="portal-bingo-logo" />
          <div>
            <p className="portal-bingo-mini-title">Lion Nation Portal</p>
            <h1>Lion Nation Blackout Bingo</h1>
            <p className="portal-bingo-subtitle">
              Welcome, {userName}. Complete every square in Mega Chat.
            </p>
          </div>
        </div>

        <div className="portal-bingo-header-actions">
          <button
            className="portal-bingo-secondary-btn"
            onClick={() => navigate("/portal")}
          >
            Back to Portal
          </button>
          <button className="portal-bingo-logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <main className="portal-bingo-main">
        {!board ? (
          <section className="portal-bingo-empty-card">
            <p className="portal-bingo-empty-label">No active bingo board</p>
            <h2>Check back soon for the next Lion Nation Blackout Bingo</h2>
          </section>
        ) : (
          <>
            <section className="portal-bingo-top-grid">
              <div className="portal-bingo-hero">
                <p className="portal-bingo-tag">How to Play</p>
                <h2>{board.title}</h2>
                <p>{board.description}</p>

                <div className="portal-bingo-progress-row">
                  <div className="portal-bingo-progress-pill">
                    Completed: {completedCount}/{squares.length}
                  </div>
                  <div
                    className={`portal-bingo-progress-pill ${
                      isBlackoutComplete ? "complete" : ""
                    }`}
                  >
                    {isBlackoutComplete ? "Blackout Complete!" : "Finish Every Square"}
                  </div>
                </div>
              </div>

              {winner ? (
                <section className="portal-bingo-winner-card">
                  <p className="portal-bingo-winner-label">First Blackout Winner</p>
                  <h3>{winner.full_name}</h3>
                  <p>{formatDateTime(winner.finished_at)}</p>
                </section>
              ) : (
                <section className="portal-bingo-winner-card">
                  <p className="portal-bingo-winner-label">First Blackout Winner</p>
                  <h3>No winner yet</h3>
                  <p>Be the first to finish the full board.</p>
                </section>
              )}
            </section>

            {message ? <p className="portal-bingo-message">{message}</p> : null}

            {isBlackoutComplete ? (
              <section className="portal-bingo-complete-card">
                <p className="portal-bingo-complete-label">You did it</p>
                <h3>Blackout Bingo Complete</h3>
                <p>
                  You completed every square on the board. Great job staying active in Mega Chat.
                </p>
              </section>
            ) : null}

            <section className="portal-bingo-board-wrap">
              <div className="portal-bingo-board">
                {squares.map((square) => {
                  const completed = Boolean(progressMap[square.id]);

                  return (
                    <button
                      key={square.id}
                      type="button"
                      className={`portal-bingo-square ${completed ? "completed" : ""}`}
                      onClick={() => handleToggleSquare(square)}
                      disabled={savingSquareId === square.id}
                    >
                      <span className="portal-bingo-square-number">
                        {square.square_order}
                      </span>

                      <span className="portal-bingo-square-text">
                        {square.square_text}
                      </span>

                      <span className="portal-bingo-square-status">
                        {savingSquareId === square.id
                          ? "Saving..."
                          : completed
                          ? "Done"
                          : "Tap to mark"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}