import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function AdminWinnerHistory() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWinners = async () => {
      const { data, error } = await supabase
        .from("prize_results")
        .select(`
          prize_label,
          won_at,
          profiles:profile_id (
            full_name
          )
        `)
        .order("won_at", { ascending: false })
        .limit(20);

      if (error) {
        console.log("Winner history error:", error.message);
      } else {
        setWinners(data || []);
      }

      setLoading(false);
    };

    loadWinners();
  }, []);

  return (
    <section className="admin-history-card">
      <div className="admin-history-top">
        <span className="admin-box-badge">Winner History</span>
      </div>

      <h3>Recent Winners</h3>

      {loading ? (
        <p className="admin-history-empty">Loading winners...</p>
      ) : winners.length === 0 ? (
        <p className="admin-history-empty">No winners yet.</p>
      ) : (
        <div className="admin-history-list">
          {winners.map((winner, index) => {
            const winnerName = winner.profiles?.full_name || "Unknown";
            const wonAt = winner.won_at
              ? new Date(winner.won_at).toLocaleString()
              : "";

            return (
              <div className="admin-history-row" key={`${winnerName}-${index}`}>
                <div>
                  <p className="admin-history-name">{winnerName}</p>
                  <p className="admin-history-time">{wonAt}</p>
                </div>

                <div className="admin-history-prize-wrap">
                  <span className="admin-history-prize">
                    {winner.prize_label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}