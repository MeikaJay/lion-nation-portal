
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const METRICS = [
  { value: "submits", label: "MM Submits" },
  { value: "csr_transfers", label: "CSR Transfers" },
  { value: "productivity", label: "Productivity %" },
  { value: "enrollment_links", label: "Enrollment Links" },
  { value: "talk_time", label: "AWS Online Hours" },
  { value: "conversion", label: "Conversion %" },
];

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "BAT", label: "BAT" },
  { value: "BA", label: "BA" },
  { value: "SBA", label: "SBA" },
];

const EMPTY_RAFFLE = {
  raffle_name: "",
  prize_name: "",
  description: "",
  start_date: "",
  end_date: "",
  audience: "everyone",
  is_active: true,
};

const EMPTY_REQUIREMENT = {
  audience: "everyone",
  metric_type: "submits",
  required_value: "",
};

const labelFor = (items, value) =>
  items.find((item) => item.value === value)?.label || value;

function RuleSelect({ options, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function NumberField({ value, onSave, placeholder, min = 0 }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      step="0.01"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (String(draft) !== String(value ?? "")) {
          onSave(draft);
        }
      }}
    />
  );
}

export default function AdminRaffles() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [raffles, setRaffles] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [ticketRules, setTicketRules] = useState([]);
  const [bonusRules, setBonusRules] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_RAFFLE);

  const [newRequirement, setNewRequirement] = useState(
    EMPTY_REQUIREMENT
  );
  const [addingRequirement, setAddingRequirement] = useState(false);

  useEffect(() => {
    loadRaffles();
  }, []);

  const selectedRaffle = useMemo(
    () => raffles.find((item) => item.id === selectedId),
    [raffles, selectedId]
  );

  const selectedRequirements = useMemo(
    () =>
      requirements.filter(
        (item) => item.raffle_id === selectedId
      ),
    [requirements, selectedId]
  );

  const selectedTicketRules = useMemo(
    () =>
      ticketRules
        .filter((item) => item.raffle_id === selectedId)
        .sort(
          (a, b) =>
            Number(a.display_order || 0) -
            Number(b.display_order || 0)
        ),
    [ticketRules, selectedId]
  );

  const selectedBonusRules = useMemo(
    () =>
      bonusRules.filter(
        (item) => item.raffle_id === selectedId
      ),
    [bonusRules, selectedId]
  );

  async function loadRaffles(preferredId = null) {
    setLoading(true);

    try {
      const [raffleResult, requirementResult, ticketResult, bonusResult] =
        await Promise.all([
          supabase
            .from("aep_raffles")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("aep_raffle_requirements").select("*"),
          supabase.from("aep_raffle_ticket_rules").select("*"),
          supabase.from("aep_raffle_bonus_rules").select("*"),
        ]);

      const error =
        raffleResult.error ||
        requirementResult.error ||
        ticketResult.error ||
        bonusResult.error;

      if (error) throw error;

      const loaded = raffleResult.data || [];

      setRaffles(loaded);
      setRequirements(requirementResult.data || []);
      setTicketRules(ticketResult.data || []);
      setBonusRules(bonusResult.data || []);

      const nextId =
        preferredId ||
        selectedId ||
        loaded[0]?.id ||
        null;

      const selected = loaded.find((item) => item.id === nextId);

      if (selected) {
        selectRaffle(selected, false);
      } else {
        setSelectedId(null);
        setForm(EMPTY_RAFFLE);
      }
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Could not load raffles.");
    } finally {
      setLoading(false);
    }
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
      is_active: raffle.is_active !== false,
    });

    setNewRequirement({
      ...EMPTY_REQUIREMENT,
      audience: raffle.audience || "everyone",
    });
  }

  function createNew() {
    setNotice("");
    setSelectedId(null);
    setForm({ ...EMPTY_RAFFLE });
    setNewRequirement({ ...EMPTY_REQUIREMENT });
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function runRpc(name, args, successMessage = "") {
    setSaving(true);
    setNotice("");

    try {
      const { data, error } = await supabase.rpc(name, args);

      if (error) throw error;

      await loadRaffles(selectedId);

      if (successMessage) setNotice(successMessage);
      return data;
    } catch (error) {
      console.error(name, error);
      setNotice(error.message || "Could not save changes.");
      return null;
    } finally {
      setSaving(false);
    }
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

    try {
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

      if (error) throw error;

      await loadRaffles(data);
      setNotice(
        selectedId
          ? "Raffle updated."
          : "Raffle created. You can now add qualifiers."
      );
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Could not save raffle.");
    } finally {
      setSaving(false);
    }
  }

  async function addRequirement() {
    if (!selectedId) {
      setNotice("Save the raffle first.");
      return;
    }

    const amount = Number(newRequirement.required_value);

    if (
      newRequirement.required_value === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setNotice("Enter a valid minimum requirement.");
      return;
    }

    const duplicate = selectedRequirements.some(
      (item) =>
        item.audience === newRequirement.audience &&
        item.metric_type === newRequirement.metric_type
    );

    if (duplicate) {
      setNotice(
        "That audience already has a requirement for this metric. Edit the existing qualifier instead."
      );
      return;
    }

    setAddingRequirement(true);
    setNotice("");

    try {
      const { error } = await supabase.rpc(
        "admin_save_raffle_requirement",
        {
          p_requirement_id: null,
          p_raffle_id: selectedId,
          p_audience: newRequirement.audience,
          p_metric_type: newRequirement.metric_type,
          p_required_value: amount,
        }
      );

      if (error) throw error;

      await loadRaffles(selectedId);
      setNotice("Qualifier added successfully.");
    } catch (error) {
      console.error(error);
      setNotice(error.message || "Could not add qualifier.");
    } finally {
      setAddingRequirement(false);
    }
  }

  async function updateRequirement(rule, field, value) {
    const updated = { ...rule, [field]: value };

    if (
      field === "audience" ||
      field === "metric_type"
    ) {
      const duplicate = selectedRequirements.some(
        (item) =>
          item.id !== rule.id &&
          item.audience === updated.audience &&
          item.metric_type === updated.metric_type
      );

      if (duplicate) {
        setNotice(
          "That metric already exists for this audience."
        );
        return;
      }
    }

    const amount = Number(updated.required_value);

    if (
      updated.required_value === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setNotice("Enter a valid minimum.");
      return;
    }

    await runRpc(
      "admin_save_raffle_requirement",
      {
        p_requirement_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_required_value: amount,
      },
      "Qualifier updated."
    );
  }

  async function deleteRequirement(id) {
    if (!window.confirm("Remove this qualifier?")) return;

    await runRpc(
      "admin_delete_raffle_requirement",
      { p_requirement_id: id },
      "Qualifier removed."
    );
  }

  async function addTicketRule() {
    if (!selectedId) return;

    await runRpc(
      "admin_save_raffle_ticket_rule",
      {
        p_rule_id: null,
        p_raffle_id: selectedId,
        p_audience: form.audience,
        p_metric_type: "submits",
        p_minimum_value: 0,
        p_maximum_value: null,
        p_tickets_per_unit: 1,
        p_display_order: selectedTicketRules.length + 1,
      },
      "Ticket range added."
    );
  }

  async function updateTicketRule(rule, field, value) {
    const updated = { ...rule, [field]: value };

    const maximum =
      updated.maximum_value === "" ||
      updated.maximum_value == null
        ? null
        : Number(updated.maximum_value);

    const minimum = Number(updated.minimum_value);
    const tickets = Number(updated.tickets_per_unit);

    if (
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      (maximum !== null &&
        (!Number.isFinite(maximum) || maximum < minimum)) ||
      !Number.isFinite(tickets) ||
      tickets < 0
    ) {
      setNotice("Check the ticket range values.");
      return;
    }

    await runRpc(
      "admin_save_raffle_ticket_rule",
      {
        p_rule_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_minimum_value: minimum,
        p_maximum_value: maximum,
        p_tickets_per_unit: tickets,
        p_display_order: Number(updated.display_order || 1),
      },
      "Ticket rule updated."
    );
  }

  async function deleteTicketRule(id) {
    if (!window.confirm("Remove this ticket rule?")) return;

    await runRpc(
      "admin_delete_raffle_ticket_rule",
      { p_rule_id: id },
      "Ticket rule removed."
    );
  }

  async function addBonusRule() {
    if (!selectedId) return;

    await runRpc(
      "admin_save_raffle_bonus_rule",
      {
        p_rule_id: null,
        p_raffle_id: selectedId,
        p_audience: form.audience,
        p_metric_type: "conversion",
        p_required_value: 0,
        p_multiplier: 2,
      },
      "Bonus multiplier added."
    );
  }

  async function updateBonusRule(rule, field, value) {
    const updated = { ...rule, [field]: value };

    const minimum = Number(updated.required_value);
    const multiplier = Number(updated.multiplier);

    if (
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      !Number.isFinite(multiplier) ||
      multiplier <= 0
    ) {
      setNotice("Check the bonus rule values.");
      return;
    }

    await runRpc(
      "admin_save_raffle_bonus_rule",
      {
        p_rule_id: updated.id,
        p_raffle_id: selectedId,
        p_audience: updated.audience,
        p_metric_type: updated.metric_type,
        p_required_value: minimum,
        p_multiplier: multiplier,
      },
      "Bonus multiplier updated."
    );
  }

  async function deleteBonusRule(id) {
    if (!window.confirm("Remove this bonus rule?")) return;

    await runRpc(
      "admin_delete_raffle_bonus_rule",
      { p_rule_id: id },
      "Bonus multiplier removed."
    );
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
            Configure qualification requirements, ticket
            earning ranges and bonus multipliers.
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
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}

      <div className="raffle-admin-layout">
        <aside className="raffle-list-panel">
          <span className="raffle-panel-label">RAFFLES</span>

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
                {labelFor(AUDIENCES, raffle.audience)}
                {" • "}
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
                  placeholder="AEP iPad Raffle"
                  onChange={(e) =>
                    updateForm("raffle_name", e.target.value)
                  }
                />
              </label>

              <label>
                Prize
                <input
                  type="text"
                  value={form.prize_name}
                  placeholder="Apple iPad"
                  onChange={(e) =>
                    updateForm("prize_name", e.target.value)
                  }
                />
              </label>

              <label>
                Audience
                <RuleSelect
                  options={AUDIENCES}
                  value={form.audience}
                  onChange={(value) =>
                    updateForm("audience", value)
                  }
                />
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
                placeholder="Describe the raffle and rewards..."
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
                      Add every requirement agents must
                      meet to qualify. There is no
                      three-qualifier limit in this editor.
                    </p>
                  </div>
                </div>

                <div
                  className="raffle-rule-row"
                  style={{
                    marginBottom: 18,
                    padding: 14,
                    border: "1px solid #b69a55",
                    borderRadius: 12,
                  }}
                >
                  <RuleSelect
                    options={AUDIENCES}
                    value={newRequirement.audience}
                    onChange={(value) =>
                      setNewRequirement((current) => ({
                        ...current,
                        audience: value,
                      }))
                    }
                  />

                  <RuleSelect
                    options={METRICS}
                    value={newRequirement.metric_type}
                    onChange={(value) =>
                      setNewRequirement((current) => ({
                        ...current,
                        metric_type: value,
                      }))
                    }
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Minimum"
                    value={newRequirement.required_value}
                    onChange={(e) =>
                      setNewRequirement((current) => ({
                        ...current,
                        required_value: e.target.value,
                      }))
                    }
                  />

                  <button
                    type="button"
                    onClick={addRequirement}
                    disabled={addingRequirement || saving}
                  >
                    {addingRequirement
                      ? "Adding..."
                      : "+ Add Qualifier"}
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
                      <RuleSelect
                        options={AUDIENCES}
                        value={rule.audience}
                        onChange={(value) =>
                          updateRequirement(
                            rule,
                            "audience",
                            value
                          )
                        }
                      />

                      <RuleSelect
                        options={METRICS}
                        value={rule.metric_type}
                        onChange={(value) =>
                          updateRequirement(
                            rule,
                            "metric_type",
                            value
                          )
                        }
                      />

                      <NumberField
                        value={rule.required_value}
                        onSave={(value) =>
                          updateRequirement(
                            rule,
                            "required_value",
                            value
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

                <p className="raffle-empty">
                  {selectedRequirements.length} qualifier
                  {selectedRequirements.length === 1
                    ? ""
                    : "s"}{" "}
                  configured.
                </p>
              </article>

              <article className="raffle-builder-card">
                <div className="raffle-card-heading">
                  <div>
                    <span>STEP 2</span>
                    <h4>Ticket Earning Rules</h4>
                    <p>
                      Set performance ranges and the
                      number of tickets earned per unit.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
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
                    <RuleSelect
                      options={AUDIENCES}
                      value={rule.audience}
                      onChange={(value) =>
                        updateTicketRule(
                          rule,
                          "audience",
                          value
                        )
                      }
                    />

                    <RuleSelect
                      options={METRICS}
                      value={rule.metric_type}
                      onChange={(value) =>
                        updateTicketRule(
                          rule,
                          "metric_type",
                          value
                        )
                      }
                    />

                    <NumberField
                      value={rule.minimum_value}
                      onSave={(value) =>
                        updateTicketRule(
                          rule,
                          "minimum_value",
                          value
                        )
                      }
                    />

                    <NumberField
                      value={rule.maximum_value}
                      placeholder="No max"
                      onSave={(value) =>
                        updateTicketRule(
                          rule,
                          "maximum_value",
                          value
                        )
                      }
                    />

                    <NumberField
                      value={rule.tickets_per_unit}
                      onSave={(value) =>
                        updateTicketRule(
                          rule,
                          "tickets_per_unit",
                          value
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
                      Optional bonus ticket multipliers.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
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
                      <RuleSelect
                        options={AUDIENCES}
                        value={rule.audience}
                        onChange={(value) =>
                          updateBonusRule(
                            rule,
                            "audience",
                            value
                          )
                        }
                      />

                      <RuleSelect
                        options={METRICS}
                        value={rule.metric_type}
                        onChange={(value) =>
                          updateBonusRule(
                            rule,
                            "metric_type",
                            value
                          )
                        }
                      />

                      <NumberField
                        value={rule.required_value}
                        onSave={(value) =>
                          updateBonusRule(
                            rule,
                            "required_value",
                            value
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
                  Audience:{" "}
                  {labelFor(AUDIENCES, form.audience)}
                </p>

                <div>
                  <b>{selectedRequirements.length}</b>{" "}
                  qualification requirements
                  {" • "}
                  <b>{selectedTicketRules.length}</b>{" "}
                  ticket ranges
                  {" • "}
                  <b>{selectedBonusRules.length}</b>{" "}
                  bonus multipliers
                </div>

                {selectedRequirements.map((rule) => (
                  <small key={rule.id}>
                    {labelFor(AUDIENCES, rule.audience)}
                    {": "}
                    {labelFor(METRICS, rule.metric_type)}
                    {" ≥ "}
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
