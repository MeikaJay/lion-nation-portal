import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./AdminSuggestionsPage.css";

export default function AdminSuggestionsPage() {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadSuggestions = async () => {
    setLoading(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("suggestions")
      .select(`
        id,
        subject,
        suggestion_text,
        is_anonymous,
        status,
        created_at,
        profiles:submitted_by (
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Suggestions error:", error.message);
      setStatusMessage(`Could not load suggestions: ${error.message}`);
    } else {
      setSuggestions(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const exportRows = useMemo(() => {
    return suggestions.map((item) => ({
      submitted_by: item.is_anonymous
        ? "Anonymous"
        : item.profiles?.full_name || "Unknown",
      subject: item.subject || "",
      suggestion_text: item.suggestion_text || "",
      status: item.status || "",
      anonymous: item.is_anonymous ? "Yes" : "No",
      created_at: item.created_at
        ? new Date(item.created_at).toLocaleString()
        : "",
    }));
  }, [suggestions]);

  const escapeCsvValue = (value) => {
    const stringValue = String(value ?? "");
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    if (!exportRows.length) {
      setStatusMessage("There are no suggestions to export.");
      return;
    }

    const headers = [
      "Submitted By",
      "Subject",
      "Suggestion",
      "Status",
      "Anonymous",
      "Created At",
    ];

    const csvLines = [
      headers.map(escapeCsvValue).join(","),
      ...exportRows.map((row) =>
        [
          row.submitted_by,
          row.subject,
          row.suggestion_text,
          row.status,
          row.anonymous,
          row.created_at,
        ]
          .map(escapeCsvValue)
          .join(",")
      ),
    ];

    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split("T")[0];
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lion-nation-suggestions-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    setStatusMessage("Suggestions exported successfully.");
  };

  const handleDeleteSuggestion = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this suggestion?"
    );

    if (!confirmed) return;

    setDeletingId(id);
    setStatusMessage("");

    const { error } = await supabase.from("suggestions").delete().eq("id", id);

    if (error) {
      setStatusMessage(`Could not delete suggestion: ${error.message}`);
      setDeletingId(null);
      return;
    }

    setSuggestions((prev) => prev.filter((item) => item.id !== id));
    setStatusMessage("Suggestion deleted.");
    setDeletingId(null);
  };

  return (
    <div className="admin-suggestions-page">
      <header className="admin-suggestions-header">
        <div>
          <p className="admin-suggestions-kicker">Lion Nation Admin</p>
          <h1>Suggestion Box</h1>
          <p className="admin-suggestions-subtitle">
            Review ideas, feedback, and anonymous submissions from the team.
          </p>
        </div>

        <div className="admin-suggestions-header-actions">
          <button
            className="admin-suggestions-export-btn"
            onClick={handleExportCsv}
            type="button"
          >
            Export CSV
          </button>

          <button
            className="admin-suggestions-back-btn"
            onClick={() => navigate("/admin")}
            type="button"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <section className="admin-suggestions-card">
        {statusMessage ? (
          <p className="admin-suggestions-status">{statusMessage}</p>
        ) : null}

        {loading ? (
          <p className="admin-suggestions-empty">Loading suggestions...</p>
        ) : suggestions.length === 0 ? (
          <p className="admin-suggestions-empty">No suggestions yet.</p>
        ) : (
          <div className="admin-suggestions-list">
            {suggestions.map((item) => {
              const name = item.is_anonymous
                ? "Anonymous"
                : item.profiles?.full_name || "Unknown";

              return (
                <div className="admin-suggestion-row" key={item.id}>
                  <div className="admin-suggestion-top">
                    <div>
                      <p className="admin-suggestion-name">{name}</p>
                      <p className="admin-suggestion-date">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="admin-suggestion-top-right">
                      <span className="admin-suggestion-status">
                        {item.status}
                      </span>

                      <button
                        type="button"
                        className="admin-suggestion-delete-btn"
                        onClick={() => handleDeleteSuggestion(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {item.subject ? (
                    <h3 className="admin-suggestion-subject">{item.subject}</h3>
                  ) : null}

                  <p className="admin-suggestion-text">
                    {item.suggestion_text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}