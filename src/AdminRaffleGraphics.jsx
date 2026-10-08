
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import AdminRaffleImageUpload from "./AdminRaffleImageUpload";
import RaffleGraphic from "./RaffleGraphic";

export default function AdminRaffleGraphics() {
  const [raffles, setRaffles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRaffles() {
    setLoading(true);

    const { data, error: loadError } = await supabase
      .from("aep_raffles")
      .select("id,raffle_name,image_path,is_active")
      .order("start_date", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      const rows = data || [];
      setRaffles(rows);
      setSelectedId((current) =>
        rows.some((raffle) => raffle.id === current)
          ? current
          : rows[0]?.id || ""
      );
      setError("");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRaffles();
  }, []);

  const selected = raffles.find((raffle) => raffle.id === selectedId);

  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ marginBottom: 18 }}>
        <span style={{ color: "#a77b21", fontSize: 12, fontWeight: 800 }}>
          RAFFLE MANAGEMENT
        </span>
        <h2>Promotional Graphics</h2>
        <p>Choose a raffle and upload its promotional image.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 13,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        {raffles.map((raffle) => (
          <option key={raffle.id} value={raffle.id}>
            {raffle.raffle_name}
            {raffle.is_active ? " — Active" : " — Inactive"}
          </option>
        ))}
      </select>

      {!loading && raffles.length === 0 && (
        <p>Create a raffle first in the Raffle Editor.</p>
      )}

      {selected && (
        <>
          <AdminRaffleImageUpload
            raffleId={selected.id}
            imagePath={selected.image_path}
            onUploaded={loadRaffles}
          />

          {selected.image_path && (
            <div style={{ marginTop: 20 }}>
              <h3>Agent-Facing Graphic Preview</h3>
              <RaffleGraphic
                imagePath={selected.image_path}
                alt={selected.raffle_name}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
