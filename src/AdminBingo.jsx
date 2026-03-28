import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminBingo.css";

const defaultSquares = [
  "Post the rules of Lion Nation in the Mega Chat",
  "Tell Lion Nation Mega Chat about your weekend",
  "Share a win for the week in Lion Nation Mega Chat",
  "Post your goal for the day in Mega Chat",
  "Shout out another agent in Mega Chat",
  "Share something positive that happened on a call",
  "Post a motivational quote in Mega Chat",
  "Share your favorite song for the week",
  "Tell the chat one thing you are proud of today",
  "Congratulate someone publicly in Mega Chat",
  "Post a funny but work appropriate moment from your week",
  "Share one sales tip in Mega Chat",
  "Tell the chat one thing that keeps you motivated",
  "Post your favorite part of Lion Nation culture",
  "Share a client win from the day",
  "Encourage a teammate in Mega Chat",
  "Post a picture, gif, or emoji combo that matches your mood",
  "Share one thing you learned this week",
  "Tell the chat your focus for tomorrow",
  "Share a proud moment from the phone",
  "Post a thank you to someone in Lion Nation",
  "Share your favorite success habit",
  "Post one word that describes your week",
  "Celebrate a teammate’s success in the chat",
  "End the week with a final win post in Mega Chat",
];

export default function AdminBingo() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("Admin");
  const [activeBoardId, setActiveBoardId] = useState(null);

  const [title, setTitle] = useState("Lion Nation Blackout Bingo");
  const [description, setDescription] = useState(
    "Complete every square by posting each task in Lion Nation Mega Chat. No post, no square."
  );
  const [squares, setSquares] = useState(defaultSquares);

  const [agentSearch, setAgentSearch] = useState("");
  const [progressRows, setProgressRows] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  const completedSquareSetupCount = useMemo(
    () => squares.filter((square) => square.trim()).length,
    [squares]
  );

  const groupedAgentProgress = useMemo(() => {
    const map = new Map();

    progressRows.forEach((row) => {
      if (!map.has(row.profile_id)) {
        map.set(row.profile_id, {
          profile_id: row.profile_id,
          full_name: row.full_name || "Unknown Agent",
          board_title: row.board_title || "",
          completed_count: 0,
          total_count: 0,
          blackout_complete: false,
          squares: [],
          latest_completed_at: null,
        });
      }

      const entry = map.get(row.profile_id);
      entry.total_count += 1;

      if (row.is_completed) {
        entry.completed_count += 1;
        if (
          row.completed_at &&
          (!entry.latest_completed_at ||
            new Date(row.completed_at) > new Date(entry.latest_completed_at))
        ) {
          entry.latest_completed_at = row.completed_at;
        }
      }

      entry.squares.push({
        square_id: row.square_id,
        square_order: row.square_order,
        square_text: row.square_text,
        is_completed: row.is_completed,
        completed_at: row.completed_at,
      });
    });

    const results = Array.from(map.values()).map((entry) => ({
      ...entry,
      squares: entry.squares.sort((a, b) => a.square_order - b.square_order),
      blackout_complete:
        entry.total_count > 0 && entry.completed_count === entry.total_count,
    }));

    results.sort((a, b) => {
      if (b.completed_count !== a.completed_count) {
        return b.completed_count - a.completed_count;
      }
      return a.full_name.localeCompare(b.full_name);
    });

    return results;
  }, [progressRows]);

  const filteredAgents = useMemo(() => {
    const term = agentSearch.trim().toLowerCase();
    if (!term) return groupedAgentProgress;

    return groupedAgentProgress.filter((agent) =>
      agent.full_name.toLowerCase().includes(term)
    );
  }, [groupedAgentProgress, agentSearch]);

  const selectedAgent = useMemo(() => {
    return groupedAgentProgress.find((agent) => agent.profile_id === selectedAgentId) || null;
  }, [groupedAgentProgress, selectedAgentId]);

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

    if (profile?.role !== "admin") {
      navigate("/portal");
      return;
    }

    if (profile?.full_name) {
      setUserName(profile.full_name.trim().split(" ")[0]);
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

    if (activeBoard) {
      setActiveBoardId(activeBoard.id);
      setTitle(activeBoard.title || "Lion Nation Blackout Bingo");
      setDescription(
        activeBoard.description ||
          "Complete every square by posting each task in Lion Nation Mega Chat. No post, no square."
      );

      const { data: squareRows, error: squaresError } = await supabase
        .from("portal_bingo_squares")
        .select("*")
        .eq("board_id", activeBoard.id)
        .order("square_order", { ascending: true });

      if (!squaresError && squareRows?.length) {
        const ordered = [...Array(25)].map((_, index) => {
          return squareRows.find((row) => row.square_order === index + 1)?.square_text || "";
        });
        setSquares(ordered);
      }

      const { data: adminProgressRows, error: progressError } = await supabase
        .from("portal_bingo_progress_admin_view")
        .select("*")
        .eq("board_id", activeBoard.id)
        .order("full_name", { ascending: true })
        .order("square_order", { ascending: true });

      if (progressError) {
        setMessage(`Could not load agent progress: ${progressError.message}`);
      } else {
        setProgressRows(adminProgressRows || []);
      }

      const { data: winnerRows, error: winnerError } = await supabase
        .from("portal_bingo_winners_view")
        .select("*")
        .eq("board_id", activeBoard.id)
        .order("finished_at", { ascending: true })
        .limit(1);

      if (!winnerError && winnerRows?.length) {
        setWinner(winnerRows[0]);
      } else {
        setWinner(null);
      }
    } else {
      setActiveBoardId(null);
      setProgressRows([]);
      setSelectedAgentId(null);
      setWinner(null);
    }

    setLoading(false);
  }

  function updateSquare(index, value) {
    setSquares((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }

  async function handleSaveBoard(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const cleanSquares = squares.map((square) => square.trim());

    if (!title.trim()) {
      setMessage("Board title is required.");
      setSaving(false);
      return;
    }

    if (cleanSquares.some((square) => !square)) {
      setMessage("All 25 bingo squares must be filled in.");
      setSaving(false);
      return;
    }

    let boardId = activeBoardId;

    if (boardId) {
      const { error } = await supabase
        .from("portal_bingo_boards")
        .update({
          title: title.trim(),
          description: description.trim(),
          is_active: true,
        })
        .eq("id", boardId);

      if (error) {
        setMessage(`Could not update board: ${error.message}`);
        setSaving(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("portal_bingo_squares")
        .delete()
        .eq("board_id", boardId);

      if (deleteError) {
        setMessage(`Could not refresh squares: ${deleteError.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: deactivateError } = await supabase
        .from("portal_bingo_boards")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        setMessage(`Could not clear old board: ${deactivateError.message}`);
        setSaving(false);
        return;
      }

      const { data: newBoard, error } = await supabase
        .from("portal_bingo_boards")
        .insert({
          title: title.trim(),
          description: description.trim(),
          is_active: true,
        })
        .select("id")
        .single();

      if (error || !newBoard?.id) {
        setMessage(`Could not create board: ${error?.message || "Unknown error"}`);
        setSaving(false);
        return;
      }

      boardId = newBoard.id;
      setActiveBoardId(boardId);
    }

    const squarePayload = cleanSquares.map((square, index) => ({
      board_id: boardId,
      square_text: square,
      square_order: index + 1,
    }));

    const { error: squareInsertError } = await supabase
      .from("portal_bingo_squares")
      .insert(squarePayload);

    if (squareInsertError) {
      setMessage(`Could not save squares: ${squareInsertError.message}`);
      setSaving(false);
      return;
    }

    setMessage("Bingo board saved successfully.");
    setSaving(false);
    await loadPage();
  }

  async function handleResetAgentProgress() {
    if (!activeBoardId) {
      setMessage("No active bingo board found.");
      return;
    }

    const confirmed = window.confirm(
      "Reset progress for all agents on the current bingo board?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("portal_bingo_progress")
      .delete()
      .eq("board_id", activeBoardId);

    if (error) {
      setMessage(`Could not reset progress: ${error.message}`);
      return;
    }

    setSelectedAgentId(null);
    setMessage("All agent bingo progress has been reset.");
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
    return <div className="admin-bingo-loading">Loading bingo manager...</div>;
  }

  return (
    <div className="admin-bingo-page">
      <header className="admin-bingo-header">
        <div className="admin-bingo-brand">
          <img src="/Lion Nation.png" alt="Lion Nation" className="admin-bingo-logo" />
          <div>
            <p className="admin-bingo-mini-title">Lion Nation Admin</p>
            <h1>Lion Nation Blackout Bingo</h1>
            <p className="admin-bingo-subtitle">
              Welcome, {userName}. Build the active board and track agent progress.
            </p>
          </div>
        </div>

        <div className="admin-bingo-header-actions">
          <button className="admin-bingo-secondary-btn" onClick={() => navigate("/admin")}>
            Back to Admin
          </button>
          <button className="admin-bingo-logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <main className="admin-bingo-main">
        <section className="admin-bingo-hero">
          <p className="admin-bingo-tag">Game Setup</p>
          <h2>Create the live blackout board</h2>
          <p>
            Every square should be a Mega Chat action. No post, no square.
            Use the tracker below to see which agents are engaging and who is close to blackout.
          </p>
        </section>

        {winner ? (
          <section className="admin-bingo-winner-card">
            <p className="admin-bingo-card-kicker">First Blackout Winner</p>
            <h3>{winner.full_name}</h3>
            <p>{winner.board_title}</p>
            <span>Finished on {formatDateTime(winner.finished_at)}</span>
          </section>
        ) : null}

        <section className="admin-bingo-form-card">
          <div className="admin-bingo-card-head">
            <div>
              <p className="admin-bingo-card-kicker">Board Editor</p>
              <h3>Active Board</h3>
            </div>
            <div className="admin-bingo-pill">{completedSquareSetupCount}/25 Squares Ready</div>
          </div>

          <form className="admin-bingo-form" onSubmit={handleSaveBoard}>
            <label>
              Board Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lion Nation Blackout Bingo"
              />
            </label>

            <label>
              Board Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the rules agents should follow..."
              />
            </label>

            <div className="admin-bingo-grid">
              {squares.map((square, index) => (
                <label key={index} className="admin-bingo-square-editor">
                  <span>Square {index + 1}</span>
                  <textarea
                    value={square}
                    onChange={(e) => updateSquare(index, e.target.value)}
                    placeholder={`Task ${index + 1}`}
                  />
                </label>
              ))}
            </div>

            <div className="admin-bingo-form-actions">
              <button
                type="submit"
                className="admin-bingo-primary-btn"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Active Bingo Board"}
              </button>

              <button
                type="button"
                className="admin-bingo-secondary-btn"
                onClick={() => setSquares(defaultSquares)}
                disabled={saving}
              >
                Reload Starter Squares
              </button>

              <button
                type="button"
                className="admin-bingo-secondary-btn danger"
                onClick={handleResetAgentProgress}
                disabled={saving}
              >
                Reset Agent Progress
              </button>
            </div>

            {message ? <p className="admin-bingo-message">{message}</p> : null}
          </form>
        </section>

        <section className="admin-bingo-progress-card">
          <div className="admin-bingo-progress-head">
            <div>
              <p className="admin-bingo-card-kicker">Participation</p>
              <h3>Agent Progress Tracker</h3>
            </div>

            <input
              type="text"
              className="admin-bingo-progress-search"
              placeholder="Search agent name..."
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
            />
          </div>

          {filteredAgents.length === 0 ? (
            <div className="admin-bingo-empty">
              No agent progress yet for the current board.
            </div>
          ) : (
            <div className="admin-bingo-progress-layout">
              <div className="admin-bingo-agent-list">
                {filteredAgents.map((agent) => (
                  <button
                    key={agent.profile_id}
                    type="button"
                    className={`admin-bingo-agent-item ${
                      selectedAgentId === agent.profile_id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedAgentId(agent.profile_id)}
                  >
                    <div className="admin-bingo-agent-top">
                      <h4>{agent.full_name}</h4>
                      <span
                        className={`admin-bingo-agent-status ${
                          agent.blackout_complete ? "complete" : ""
                        }`}
                      >
                        {agent.blackout_complete ? "Blackout Complete" : "In Progress"}
                      </span>
                    </div>

                    <p>
                      {agent.completed_count}/{agent.total_count} completed
                    </p>
                  </button>
                ))}
              </div>

              <div className="admin-bingo-agent-detail">
                {!selectedAgent ? (
                  <div className="admin-bingo-empty">
                    Select an agent to view square by square progress.
                  </div>
                ) : (
                  <>
                    <div className="admin-bingo-agent-detail-head">
                      <div>
                        <p className="admin-bingo-card-kicker">Selected Agent</p>
                        <h3>{selectedAgent.full_name}</h3>
                      </div>

                      <div className="admin-bingo-agent-summary">
                        <div className="admin-bingo-pill">
                          {selectedAgent.completed_count}/{selectedAgent.total_count} done
                        </div>
                        <div
                          className={`admin-bingo-pill ${
                            selectedAgent.blackout_complete ? "complete-pill" : ""
                          }`}
                        >
                          {selectedAgent.blackout_complete ? "Finished" : "Working"}
                        </div>
                      </div>
                    </div>

                    <div className="admin-bingo-agent-squares">
                      {selectedAgent.squares.map((square) => (
                        <div
                          key={square.square_id}
                          className={`admin-bingo-agent-square ${
                            square.is_completed ? "completed" : ""
                          }`}
                        >
                          <div className="admin-bingo-agent-square-top">
                            <span>Square {square.square_order}</span>
                            <strong>
                              {square.is_completed ? "Completed" : "Not Completed"}
                            </strong>
                          </div>
                          <p>{square.square_text}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}