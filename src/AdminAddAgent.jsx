
import { useState } from "react";
import { supabase } from "./supabase";

const initialForm = {
  first_name: "",
  last_name: "",
  username: "",
  password: "",
  team_id: "",
  aep_target: "",
  raffle_role: "BA",
  incentive_category: "everyone_else",
};

export default function AdminAddAgent({ teams = [], onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createAgent(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setMessage("");
    setSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-create-agent",
        {
          body: {
            ...form,
            aep_target: Number(form.aep_target),
          },
        }
      );

      if (error) {
        let detail = error.message;

        if (error.context?.json) {
          try {
            const result = await error.context.json();
            detail = result.error || detail;
          } catch {
            // Keep the original error.
          }
        }

        throw new Error(detail);
      }

      if (!data?.success) {
        throw new Error(data?.error || "Account creation failed.");
      }

      setMessage(data.message || "Agent created successfully.");
      setSuccess(true);
      setForm(initialForm);

      if (onCreated) await onCreated();
    } catch (error) {
      setMessage(error.message || "Unable to create agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-add-agent">
      <div className="admin-add-agent-heading">
        <div>
          <span>ROSTER MANAGEMENT</span>
          <h3>Add New Agent</h3>
          <p>Create a login and assign the agent to Lion Nation.</p>
        </div>
      </div>

      {message && (
        <div
          className={
            success
              ? "admin-add-agent-message success"
              : "admin-add-agent-message"
          }
        >
          {message}
        </div>
      )}

      <form onSubmit={createAgent}>
        <div className="admin-add-agent-grid">
          <label>
            First Name
            <input
              required
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </label>

          <label>
            Last Name
            <input
              required
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </label>

          <label>
            Username
            <input
              required
              minLength={3}
              maxLength={40}
              placeholder="firstname.lastname"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
            />
            <small>Login will be username@lion.com</small>
          </label>

          <label>
            Temporary Password
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </label>

          <label>
            Team
            <select
              required
              value={form.team_id}
              onChange={(e) => update("team_id", e.target.value)}
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
              required
              type="number"
              min="0"
              step="1"
              value={form.aep_target}
              onChange={(e) => update("aep_target", e.target.value)}
            />
          </label>

          <label>
            Raffle Role
            <select
              value={form.raffle_role}
              onChange={(e) => update("raffle_role", e.target.value)}
            >
              <option value="BAT">BAT</option>
              <option value="BA">BA</option>
              <option value="SBA">SBA</option>
            </select>
          </label>

          <label>
            Incentive Category
            <select
              value={form.incentive_category}
              onChange={(e) => update("incentive_category", e.target.value)}
            >
              <option value="2026_hire">2026 Hire</option>
              <option value="everyone_else">Everyone Else</option>
            </select>
          </label>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Creating Account..." : "+ Create Agent Account"}
        </button>
      </form>

      <p className="admin-add-agent-footnote">
        New agents start with zero submits and zero performance totals.
        Incentive group assignments will be managed separately.
      </p>
    </section>
  );
}
