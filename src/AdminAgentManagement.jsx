
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./AdminAgentManagement.css";

const emptyForm = {
  first_name: "",
  last_name: "",
  team_id: "",
  aep_target: "",
  incentive_category: "everyone_else",
  raffle_role: "BA",
};

export default function AdminAgentManagement({ teams = [], onChanged }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("aep_people")
      .select("*")
      .eq("role", "agent")
      .order("last_name");

    if (error) setMessage(error.message);
    else setAgents(data || []);
    setLoading(false);
  }

  const visibleAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesStatus =
        filter === "all" ||
        (filter === "active" && agent.is_active) ||
        (filter === "inactive" && !agent.is_active);

      const name =
        `${agent.first_name} ${agent.last_name} ${agent.username}`
          .toLowerCase();

      return matchesStatus && name.includes(search.toLowerCase());
    });
  }, [agents, filter, search]);

  const counts = {
    active: agents.filter((a) => a.is_active).length,
    inactive: agents.filter((a) => !a.is_active).length,
    all: agents.length,
  };

  function teamName(id) {
    return teams.find((team) => team.id === id)?.team_name || "Unassigned";
  }

  function openEdit(agent) {
    setMessage("");
    setEditing(agent);
    setForm({
      first_name: agent.first_name || "",
      last_name: agent.last_name || "",
      team_id: agent.team_id || "",
      aep_target: String(agent.aep_target ?? 0),
      incentive_category: agent.incentive_category || "everyone_else",
      raffle_role: agent.raffle_role || "BA",
    });
  }

  async function saveAgent() {
    if (!editing) return;

    const target = Number(form.aep_target);

    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.team_id ||
      form.aep_target.trim() === "" ||
      !Number.isInteger(target) ||
      target < 0
    ) {
      setMessage("Complete all required fields with a valid AEP goal.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_update_agent", {
      p_agent_id: editing.id,
      p_first_name: form.first_name.trim(),
      p_last_name: form.last_name.trim(),
      p_username: editing.username,
      p_team_id: form.team_id,
      p_aep_target: target,
      p_incentive_category: form.incentive_category,
      p_raffle_role: form.raffle_role,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEditing(null);
    await loadAgents();
    if (onChanged) await onChanged();
    setMessage("Agent updated successfully.");
  }

  async function toggleActive(agent) {
    const action = agent.is_active ? "deactivate" : "reactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${agent.first_name} ${agent.last_name}?`
      )
    ) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_set_agent_active", {
      p_agent_id: agent.id,
      p_is_active: !agent.is_active,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadAgents();
    if (onChanged) await onChanged();
    setMessage(`Agent ${action}d successfully.`);
  }

  if (loading) return <p>Loading agent management...</p>;

  return (
    <section className="agent-management">
      <div className="agent-management-heading">
        <div>
          <span>PEOPLE & TEAMS</span>
          <h2>Agent Management</h2>
          <p>
            Manage AEP goals, teams, classifications, and account status.
          </p>
        </div>
      </div>

      {message && <div className="agent-management-notice">{message}</div>}

      <div className="agent-management-toolbar">
        <div className="agent-management-filters">
          {[
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["all", "All Agents"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search agents..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="agent-management-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Team</th>
              <th>AEP Goal</th>
              <th>Submits</th>
              <th>Raffle Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleAgents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <strong>{agent.first_name} {agent.last_name}</strong>
                  <small>@{agent.username}</small>
                </td>
                <td>{teamName(agent.team_id)}</td>
                <td>{Number(agent.aep_target || 0).toLocaleString()}</td>
                <td>{Number(agent.current_submits || 0).toLocaleString()}</td>
                <td>{agent.raffle_role || "Not Set"}</td>
                <td>{agent.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <div className="agent-management-actions">
                    <button type="button" onClick={() => openEdit(agent)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={agent.is_active ? "danger" : ""}
                      onClick={() => toggleActive(agent)}
                    >
                      {agent.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibleAgents.length === 0 && (
          <p className="agent-management-empty">No matching agents.</p>
        )}
      </div>

      {editing && (
        <div className="agent-management-overlay">
          <div className="agent-management-modal">
            <h3>Edit Agent</h3>
            <p>@{editing.username}</p>

            <div className="agent-management-fields">
              <label>
                First Name
                <input
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                />
              </label>

              <label>
                Last Name
                <input
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                />
              </label>

              <label>
                Team
                <select
                  value={form.team_id}
                  onChange={(e) =>
                    setForm({ ...form, team_id: e.target.value })
                  }
                >
                  <option value="">Select Team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                AEP Goal
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.aep_target}
                  onChange={(e) =>
                    setForm({ ...form, aep_target: e.target.value })
                  }
                />
              </label>

              <label>
                Incentive Category
                <select
                  value={form.incentive_category}
                  onChange={(e) =>
                    setForm({ ...form, incentive_category: e.target.value })
                  }
                >
                  <option value="2026_hire">2026 Hire</option>
                  <option value="everyone_else">Everyone Else</option>
                </select>
              </label>

              <label>
                Raffle Role
                <select
                  value={form.raffle_role}
                  onChange={(e) =>
                    setForm({ ...form, raffle_role: e.target.value })
                  }
                >
                  <option value="BAT">BAT</option>
                  <option value="BA">BA</option>
                  <option value="SBA">SBA</option>
                </select>
              </label>
            </div>

            <div className="agent-management-modal-actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" disabled={saving} onClick={saveAgent}>
                {saving ? "Saving..." : "Save Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
