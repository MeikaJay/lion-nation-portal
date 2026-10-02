import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const METRICS = [
  { value: "submits", label: "Sales / Submits" },
  { value: "csr_transfers", label: "CSR Transfers" },
  { value: "productivity", label: "Productivity %" },
  { value: "enrollment_links", label: "Enrollment Links" },
  { value: "talk_time", label: "Talk Time Hours" },
  { value: "conversion", label: "Conversion %" },
];

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "BAT", label: "BAT" },
  { value: "BA", label: "BA" },
  { value: "SBA", label: "SBA" },
];

function metricLabel(value) {
  return (
    METRICS.find((metric) => metric.value === value)?.label ||
    value
  );
}

function audienceLabel(value) {
  return (
    AUDIENCES.find((audience) => audience.value === value)
      ?.label || value
  );
}

export default function AdminRaffles() {
  const [loading, setLoading] = useState(true);
  const [raffles, setRaffles] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [ticketRules, setTicketRules] = useState([]);
  const [bonusRules, setBonusRules] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    raffle_name: "",
    prize_name: "",
    description: "",
    start_date: "",
    end_date: "",
    audience: "everyone",
    is_active: true,
  });

  useEffect(() => {
    loadRaffles();
  }, []);

  const selectedRaffle = useMemo(
    () => raffles.find((raffle) => raffle.id === selectedId),
    [raffles, selectedId]
  );

  const selectedRequirements = useMemo(
    () =>
      requirements.filter(
        (requirement) => requirement.raffle_id === selectedId
      ),
    [requirements, selectedId]
  );

  const selectedTicketRules = useMemo(
    () =>
      ticketRules
        .filter((rule) => rule.raffle_id === selectedId)
        .sort(
          (a, b) =>
            Number(a.display_order || 0) -
            Number(b.display_order || 0)
        ),
    [ticketRules, selectedId]
  );

  const selectedBonusRules = useMemo(
    () =>
      bonusRules.filter((rule) => rule.raffle_id === selectedId),
    [bonusRules, selectedId]
  );

  async function loadRaffles(preferredId = null) {
    setLoading(true);

    const [
      raffleResult,
      requirementResult,
      ticketResult,
      bonusResult,
    ] = await Promise.all([
      supabase
        .from("aep_raffles")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("aep_raffle_requirements")
        .select("*"),

      supabase
        .from("aep_raffle_ticket_rules")
        .select("*"),

      supabase
        .from("aep_raffle_bonus_rules")
        .select("*"),
    ]);

    const error =
      raffleResult.error ||
      requirementResult.error ||
      ticketResult.error ||
      bonusResult.error;

    if (error) {
      console.error(error);
      setNotice(error.message);
      setLoading(false);
      return;
    }

    const loadedRaffles = raffleResult.data || [];

    setRaffles(loadedRaffles);
    setRequirements(requirementResult.data || []);
    setTicketRules(ticketResult.data || []);
    setBonusRules(bonusResult.data || []);

    const nextId =
      preferredId ||
      selectedId ||
      loadedRaffles[0]?.id ||
      null;

    if (nextId) {
      const raffle = loadedRaffles.find(
        (item) => item.id === nextId
      );

      if (raffle) {
        selectRaffle(raffle, false);
      }
    }

    setLoading(false);
  }

  function selectRaffle(raffle, clearNotice = true) {
    if (clearNotice) setNotice("");

    setSelectedId(raffle.id);

    setForm({
      raffle_name: raffle.raffle_name || "",
      prize_name: raffle.prize_name || "",
      description: raffle.description || "",
      start_date: raffle.start_date || "",
      end_date: raffle.end_date || "",
      audience: raffle.audience || "everyone",
      is_active: Boolean(raffle.is_active),
    });
  }

  function createNew() {
    setNotice("");
    setSelectedId(null);

    setForm({
      raffle_name: "",
      prize_name: "",
      description: "",
      start_date: "",
      end_date: "",
      audience: "everyone",
      is_active: true,
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveRaffle() {
    if (!form.raffle_name.trim()) {
      setNotice("Enter a raffle name.");
      return;
    }

    if (!form.prize_name.trim()) {
      setNotice("Enter the raffle prize.");
      return;
    }

    setSaving(true);
    setNotice("");

    const { data, error } = await supabase.rpc(
      "admin_save_raffle",
      {
        p_raffle_id: selectedId,
        p_raffle_name: form.raffle_name.trim(),
        p_prize_name: form.prize_name.trim(),
        p_description: form.description.trim(),
        p_start_date: form.start_date || null,
        p_end_date: form.end_date || null,
        p_audience: form.audience,
        p_is_active: form.is_active,
      }
    );

    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }

    await loadRaffles(data);

    setNotice(
      selectedId
        ? "Raffle updated."
        : "Raffle created. Now add the qualification rules."
    );

    setSaving(false);
  }

  async function addRequirement() {
    if (!selectedId) {
      setNotice("Save the raffle first.");
      return;
    }

    const { error } = await supabase.rpc(
      "admin_save_raffle_requirement",
      {
        p_requirement_id: null,
        p_raffle_id: selectedId,
        p_audience: form.audience,
        p_metric_type: "submits",
        p_required_value: 0,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function updateRequirement(requirement, field, value) {
    const updated = {
      ...requirement,
      [field]: value,
    };

    const { error } = await supabase.rpc(
      "admin_save_raffle_requirement",
      {
        p_requirement_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_required_value: Number(updated.required_value || 0),
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function deleteRequirement(id) {
    const { error } = await supabase.rpc(
      "admin_delete_raffle_requirement",
      {
        p_requirement_id: id,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function addTicketRule() {
    if (!selectedId) {
      setNotice("Save the raffle first.");
      return;
    }

    const nextOrder = selectedTicketRules.length + 1;

    const { error } = await supabase.rpc(
      "admin_save_raffle_ticket_rule",
      {
        p_rule_id: null,
        p_raffle_id: selectedId,
        p_audience: form.audience,
        p_metric_type: "submits",
        p_minimum_value: 0,
        p_maximum_value: null,
        p_tickets_per_unit: 1,
        p_display_order: nextOrder,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function updateTicketRule(rule, field, value) {
    const updated = {
      ...rule,
      [field]: value,
    };

    const maximum =
      updated.maximum_value === "" ||
      updated.maximum_value === null
        ? null
        : Number(updated.maximum_value);

    const { error } = await supabase.rpc(
      "admin_save_raffle_ticket_rule",
      {
        p_rule_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_minimum_value: Number(updated.minimum_value || 0),
        p_maximum_value: maximum,
        p_tickets_per_unit: Number(
          updated.tickets_per_unit || 0
        ),
        p_display_order: Number(updated.display_order || 1),
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function deleteTicketRule(id) {
    const { error } = await supabase.rpc(
      "admin_delete_raffle_ticket_rule",
      {
        p_rule_id: id,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function addBonusRule() {
    if (!selectedId) {
      setNotice("Save the raffle first.");
      return;
    }

    const { error } = await supabase.rpc(
      "admin_save_raffle_bonus_rule",
      {
        p_rule_id: null,
        p_raffle_id: selectedId,
        p_audience: form.audience,
        p_metric_type: "conversion",
        p_required_value: 0,
        p_multiplier: 2,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function updateBonusRule(rule, field, value) {
    const updated = {
      ...rule,
      [field]: value,
    };

    const { error } = await supabase.rpc(
      "admin_save_raffle_bonus_rule",
      {
        p_rule_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_required_value: Number(updated.required_value || 0),
        p_multiplier: Number(updated.multiplier || 1),
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  async function deleteBonusRule(id) {
    const { error } = await supabase.rpc(
      "admin_delete_raffle_bonus_rule",
      {
        p_rule_id: id,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadRaffles(selectedId);
  }

  if (loading) {
    return (
      <section className="admin-section">
        <div className="admin-section-heading">
          <p>RAFFLES & PRIZES</p>
          <h3>Loading Raffles...</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-heading raffle-heading">
        <div>
          <p>RAFFLES & PRIZES</p>
          <h3>Raffle Builder</h3>
          <span>
            Build qualification rules, ticket earning ranges and
            bonus multipliers.
          </span>
        </div>

        <button
          type="button"
          className="raffle-new-button"
          onClick={createNew}
        >
          + New Raffle
        </button>
      </div>

      {notice && (
        <div className="admin-notice">{notice}</div>
      )}

      <div className="raffle-admin-layout">
        <aside className="raffle-list-panel">
          <span className="raffle-panel-label">
            RAFFLES
          </span>

          {raffles.length === 0 && (
            <p className="raffle-empty">
              No raffles created yet.
            </p>
          )}

          {raffles.map((raffle) => (
            <button
              type="button"
              key={raffle.id}
              className={
                raffle.id === selectedId
                  ? "raffle-list-item active"
                  : "raffle-list-item"
              }
              onClick={() => selectRaffle(raffle)}
            >
              <strong>{raffle.raffle_name}</strong>

              <span>{raffle.prize_name}</span>

              <small>
                {audienceLabel(raffle.audience)} •{" "}
                {raffle.is_active ? "Active" : "Inactive"}
              </small>
            </button>
          ))}
        </aside>

        <div className="raffle-builder">
          <article className="raffle-builder-card">
            <div className="raffle-card-heading">
              <div>
                <span>RAFFLE DETAILS</span>
                <h4>
                  {selectedRaffle
                    ? selectedRaffle.raffle_name
                    : "Create Raffle"}
                </h4>
              </div>

              <label className="raffle-active-toggle">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    updateForm("is_active", e.target.checked)
                  }
                />
                Active
              </label>
            </div>

            <div className="raffle-form-grid">
              <label>
                Raffle Name
                <input
                  type="text"
                  value={form.raffle_name}
                  onChange={(e) =>
                    updateForm("raffle_name", e.target.value)
                  }
                  placeholder="AEP iPad Raffle"
                />
              </label>

              <label>
                Prize
                <input
                  type="text"
                  value={form.prize_name}
                  onChange={(e) =>
                    updateForm("prize_name", e.target.value)
                  }
                  placeholder="Apple iPad"
                />
              </label>

              <label>
                Audience
                <select
                  value={form.audience}
                  onChange={(e) =>
                    updateForm("audience", e.target.value)
                  }
                >
                  {AUDIENCES.map((audience) => (
                    <option
                      key={audience.value}
                      value={audience.value}
                    >
                      {audience.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Start Date
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    updateForm("start_date", e.target.value)
                  }
                />
              </label>

              <label>
                End Date
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    updateForm("end_date", e.target.value)
                  }
                />
              </label>
            </div>

            <label className="raffle-description">
              Description / Additional Rewards
              <textarea
                value={form.description}
                onChange={(e) =>
                  updateForm("description", e.target.value)
                }
                placeholder="Example: All qualifiers receive food delivery credit."
              />
            </label>

            <button
              type="button"
              className="raffle-save-main"
              disabled={saving}
              onClick={saveRaffle}
            >
              {saving ? "Saving..." : "Save Raffle"}
            </button>
          </article>

          {selectedId && (
            <>
              <article className="raffle-builder-card">
                <div className="raffle-card-heading">
                  <div>
                    <span>STEP 1</span>
                    <h4>Qualification Requirements</h4>
                    <p>
                      Every requirement below must be met to
                      qualify.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addRequirement}
                  >
                    + Add Requirement
                  </button>
                </div>

                <div className="raffle-rule-list">
                  {selectedRequirements.length === 0 && (
                    <p className="raffle-empty">
                      No qualification requirements yet.
                    </p>
                  )}

                  {selectedRequirements.map((rule) => (
                    <div
                      className="raffle-rule-row"
                      key={rule.id}
                    >
                      <select
                        value={rule.audience}
                        onChange={(e) =>
                          updateRequirement(
                            rule,
                            "audience",
                            e.target.value
                          )
                        }
                      >
                        {AUDIENCES.map((audience) => (
                          <option
                            key={audience.value}
                            value={audience.value}
                          >
                            {audience.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={rule.metric_type}
                        onChange={(e) =>
                          updateRequirement(
                            rule,
                            "metric_type",
                            e.target.value
                          )
                        }
                      >
                        {METRICS.map((metric) => (
                          <option
                            key={metric.value}
                            value={metric.value}
                          >
                            {metric.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={rule.required_value}
                        onBlur={(e) =>
                          updateRequirement(
                            rule,
                            "required_value",
                            e.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        className="raffle-delete"
                        onClick={() =>
                          deleteRequirement(rule.id)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="raffle-builder-card">
                <div className="raffle-card-heading">
                  <div>
                    <span>STEP 2</span>
                    <h4>Ticket Earning Rules</h4>
                    <p>
                      Set performance ranges and how many tickets
                      each unit earns.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addTicketRule}
                  >
                    + Add Ticket Range
                  </button>
                </div>

                <div className="raffle-ticket-header">
                  <span>Audience</span>
                  <span>Metric</span>
                  <span>From</span>
                  <span>Through</span>
                  <span>Tickets / Unit</span>
                  <span />
                </div>

                {selectedTicketRules.length === 0 && (
                  <p className="raffle-empty">
                    No ticket rules yet.
                  </p>
                )}

                {selectedTicketRules.map((rule) => (
                  <div
                    className="raffle-ticket-row"
                    key={rule.id}
                  >
                    <select
                      value={rule.audience}
                      onChange={(e) =>
                        updateTicketRule(
                          rule,
                          "audience",
                          e.target.value
                        )
                      }
                    >
                      {AUDIENCES.map((audience) => (
                        <option
                          key={audience.value}
                          value={audience.value}
                        >
                          {audience.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={rule.metric_type}
                      onChange={(e) =>
                        updateTicketRule(
                          rule,
                          "metric_type",
                          e.target.value
                        )
                      }
                    >
                      {METRICS.map((metric) => (
                        <option
                          key={metric.value}
                          value={metric.value}
                        >
                          {metric.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={rule.minimum_value}
                      onBlur={(e) =>
                        updateTicketRule(
                          rule,
                          "minimum_value",
                          e.target.value
                        )
                      }
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={rule.maximum_value ?? ""}
                      placeholder="No max"
                      onBlur={(e) =>
                        updateTicketRule(
                          rule,
                          "maximum_value",
                          e.target.value
                        )
                      }
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={rule.tickets_per_unit}
                      onBlur={(e) =>
                        updateTicketRule(
                          rule,
                          "tickets_per_unit",
                          e.target.value
                        )
                      }
                    />

                    <button
                      type="button"
                      className="raffle-delete"
                      onClick={() =>
                        deleteTicketRule(rule.id)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </article>

              <article className="raffle-builder-card">
                <div className="raffle-card-heading">
                  <div>
                    <span>STEP 3</span>
                    <h4>Bonus Multipliers</h4>
                    <p>
                      Example: 30% conversion doubles raffle
                      tickets.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addBonusRule}
                  >
                    + Add Multiplier
                  </button>
                </div>

                <div className="raffle-rule-list">
                  {selectedBonusRules.length === 0 && (
                    <p className="raffle-empty">
                      No bonus multipliers yet.
                    </p>
                  )}

                  {selectedBonusRules.map((rule) => (
                    <div
                      className="raffle-rule-row"
                      key={rule.id}
                    >
                      <select
                        value={rule.audience}
                        onChange={(e) =>
                          updateBonusRule(
                            rule,
                            "audience",
                            e.target.value
                          )
                        }
                      >
                        {AUDIENCES.map((audience) => (
                          <option
                            key={audience.value}
                            value={audience.value}
                          >
                            {audience.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={rule.metric_type}
                        onChange={(e) =>
                          updateBonusRule(
                            rule,
                            "metric_type",
                            e.target.value
                          )
                        }
                      >
                        {METRICS.map((metric) => (
                          <option
                            key={metric.value}
                            value={metric.value}
                          >
                            {metric.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={rule.required_value}
                        onBlur={(e) =>
                          updateBonusRule(
                            rule,
                            "required_value",
                            e.target.value
                          )
                        }
                      />

                      <select
                        value={String(rule.multiplier)}
                        onChange={(e) =>
                          updateBonusRule(
                            rule,
                            "multiplier",
                            e.target.value
                          )
                        }
                      >
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                        <option value="4">4x</option>
                      </select>

                      <button
                        type="button"
                        className="raffle-delete"
                        onClick={() =>
                          deleteBonusRule(rule.id)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="raffle-preview-card">
                <span>RAFFLE STRUCTURE</span>

                <h4>{form.raffle_name}</h4>

                <strong>{form.prize_name}</strong>

                <p>
                  Audience: {audienceLabel(form.audience)}
                </p>

                <div>
                  <b>
                    {selectedRequirements.length}
                  </b>{" "}
                  qualification requirement
                  {selectedRequirements.length === 1 ? "" : "s"}
                  {" • "}
                  <b>{selectedTicketRules.length}</b> ticket
                  range
                  {selectedTicketRules.length === 1 ? "" : "s"}
                  {" • "}
                  <b>{selectedBonusRules.length}</b> bonus
                  multiplier
                  {selectedBonusRules.length === 1 ? "" : "s"}
                </div>

                {selectedRequirements.map((rule) => (
                  <small key={rule.id}>
                    {audienceLabel(rule.audience)}:{" "}
                    {metricLabel(rule.metric_type)} ≥{" "}
                    {rule.required_value}
                  </small>
                ))}
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
}