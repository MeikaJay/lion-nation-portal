
import { useState } from "react";
import AdminRaffles from "./AdminRaffles";
import AdminRaffleGraphics from "./AdminRaffleGraphics";

export default function AdminRafflesWorkspace() {
  const [section, setSection] = useState("editor");
  const [version, setVersion] = useState(0);

  function switchSection(next) {
    setSection(next);
    setVersion((current) => current + 1);
  }

  const buttonStyle = (selected) => ({
    padding: "13px 20px",
    borderRadius: 10,
    border: "1px solid #d9c89e",
    background: selected ? "#191919" : "#fffdf8",
    color: selected ? "#edc66d" : "#292929",
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={buttonStyle(section === "editor")}
          onClick={() => switchSection("editor")}
        >
          Raffle Editor & Qualifications
        </button>

        <button
          type="button"
          style={buttonStyle(section === "graphics")}
          onClick={() => switchSection("graphics")}
        >
          Promotional Graphics
        </button>
      </div>

      {section === "editor" ? (
        <AdminRaffles key={version} />
      ) : (
        <AdminRaffleGraphics key={version} />
      )}
    </section>
  );
}
