import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const emptyIncentive = {
  id: null,
  incentive_name: "",
  description: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

const emptyTier = {
  id: null,
  tier_name: "",
  required_submits: "",
  earned_amount: "",
  display_order: 1,
};

export default function AdminIncentives() {
  const [incentives, setIncentives] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptyIncentive);
  const [tiers, setTiers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadIncentives();
  }, []);

  async function loadIncentives(selectId = null) {
    setLoading(true);
    setNotice("");

    try {
      const { data: incentiveData, error: incentiveError } =
        await supabase
          .from("aep_incentives")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

      if (incentiveError) {
        throw incentiveError;
      }

      const loaded = incentiveData || [];

      setIncentives(loaded);

      const idToLoad =
        selectId ||
        selectedId ||
        loaded[0]?.id ||
        null;

      if (idToLoad) {
        await loadOneIncentive(idToLoad, loaded);
      } else {
        startNewIncentive();
      }
    } catch (error) {
      console.error(error);
      setNotice(
        error.message ||
          "Could not load incentives."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadOneIncentive(
    incentiveId,
    incentiveList = incentives
  ) {
    const incentive = incentiveList.find(
      (item) => item.id === incentiveId
    );

    if (!incentive) return;

    setSelectedId(incentive.id);

    setForm({
      id: incentive.id,
      incentive_name:
        incentive.incentive_name || "",
      description:
        incentive.description || "",
      start_date:
        incentive.start_date || "",
      end_date:
        incentive.end_date || "",
      is_active:
        incentive.is_active !== false,
    });

    const { data, error } = await supabase
      .from("aep_incentive_tiers")
      .select("*")
      .eq("incentive_id", incentive.id)
      .order("display_order")
      .order("required_submits");

    if (error) {
      setNotice(error.message);
      return;
    }

    setTiers(
      (data || []).map((tier) => ({
        id: tier.id,
        tier_name: tier.tier_name,
        required_submits:
          tier.required_submits,
        earned_amount:
          tier.earned_amount,
        display_order:
          tier.display_order,
      }))
    );
  }

  function startNewIncentive() {
    setSelectedId(null);
    setForm(emptyIncentive);
    setTiers([]);
    setNotice("");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addTier() {
    setTiers((current) => [
      ...current,
      {
        ...emptyTier,
        display_order:
          current.length + 1,
      },
    ]);
  }

  function updateTier(index, field, value) {
    setTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [field]: value,
            }
          : tier
      )
    );
  }

  async function removeTier(index) {
    const tier = tiers[index];

    if (!tier.id) {
      setTiers((current) =>
        current.filter(
          (_, tierIndex) =>
            tierIndex !== index
        )
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${tier.tier_name}?`
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc(
      "admin_delete_incentive_tier",
      {
        p_tier_id: tier.id,
      }
    );

    if (error) {
      setNotice(error.message);
      return;
    }

    setTiers((current) =>
      current.filter(
        (_, tierIndex) =>
          tierIndex !== index
      )
    );

    setNotice("Tier deleted.");
  }

  async function saveIncentive() {
    setSaving(true);
    setNotice("");

    try {
      if (!form.incentive_name.trim()) {
        throw new Error(
          "Enter an incentive name."
        );
      }

      for (const tier of tiers) {
        const submits = Number(
          tier.required_submits
        );

        const amount = Number(
          tier.earned_amount
        );

        if (!tier.tier_name.trim()) {
          throw new Error(
            "Every tier needs a name."
          );
        }

        if (
          !Number.isInteger(submits) ||
          submits < 0
        ) {
          throw new Error(
            "Required submits must be a whole number."
          );
        }

        if (
          !Number.isFinite(amount) ||
          amount < 0
        ) {
          throw new Error(
            "Earned amount cannot be negative."
          );
        }
      }

      const { data: incentiveId, error } =
        await supabase.rpc(
          "admin_save_incentive",
          {
            p_incentive_id:
              form.id || null,

            p_incentive_name:
              form.incentive_name.trim(),

            p_description:
              form.description.trim(),

            p_start_date:
              form.start_date || null,

            p_end_date:
              form.end_date || null,

            p_is_active:
              form.is_active,
          }
        );

      if (error) throw error;

      for (
        let index = 0;
        index < tiers.length;
        index += 1
      ) {
        const tier = tiers[index];

        const { error: tierError } =
          await supabase.rpc(
            "admin_save_incentive_tier",
            {
              p_tier_id:
                tier.id || null,

              p_incentive_id:
                incentiveId,

              p_tier_name:
                tier.tier_name.trim(),

              p_required_submits:
                Number(
                  tier.required_submits
                ),

              p_earned_amount:
                Number(
                  tier.earned_amount
                ),

              p_display_order:
                index + 1,
            }
          );

        if (tierError) {
          throw tierError;
        }
      }

      await loadIncentives(
        incentiveId
      );

      setNotice(
        "Incentive saved successfully."
      );
    } catch (error) {
      console.error(error);

      setNotice(
        error.message ||
          "Could not save incentive."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="admin-section">
        <div className="admin-section-heading">
          <p>AEP INCENTIVES</p>
          <h3>Loading Incentives...</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-heading admin-incentive-heading">
        <div>
          <p>AEP INCENTIVES</p>

          <h3>
            Incentive Management
          </h3>

          <span>
            Build incentive tiers and
            payout levels. Agent progress
            is calculated automatically
            from current submits.
          </span>
        </div>

        <button
          type="button"
          className="admin-new-incentive"
          onClick={startNewIncentive}
        >
          + New Incentive
        </button>
      </div>

      {notice && (
        <div className="admin-notice">
          {notice}
        </div>
      )}

      <div className="admin-incentive-layout">
        <aside className="admin-incentive-list">
          <span className="admin-incentive-list-label">
            INCENTIVES
          </span>

          {incentives.length === 0 && (
            <p className="admin-empty-text">
              No incentives created yet.
            </p>
          )}

          {incentives.map(
            (incentive) => (
              <button
                type="button"
                key={incentive.id}
                className={
                  selectedId ===
                  incentive.id
                    ? "admin-incentive-option active"
                    : "admin-incentive-option"
                }
                onClick={() =>
                  loadOneIncentive(
                    incentive.id
                  )
                }
              >
                <strong>
                  {
                    incentive.incentive_name
                  }
                </strong>

                <span>
                  {incentive.is_active
                    ? "ACTIVE"
                    : "INACTIVE"}
                </span>
              </button>
            )
          )}
        </aside>

        <div className="admin-incentive-editor">
          <div className="admin-incentive-card">
            <div className="admin-card-title">
              <div>
                <span>
                  INCENTIVE DETAILS
                </span>

                <h4>
                  {form.id
                    ? "Edit Incentive"
                    : "Create Incentive"}
                </h4>
              </div>

              <label className="admin-active-toggle">
                <input
                  type="checkbox"
                  checked={
                    form.is_active
                  }
                  onChange={(e) =>
                    updateForm(
                      "is_active",
                      e.target.checked
                    )
                  }
                />

                <span>Active</span>
              </label>
            </div>

            <div className="admin-form-grid">
              <div className="admin-field admin-field-full">
                <label>
                  Incentive Name
                </label>

                <input
                  type="text"
                  value={
                    form.incentive_name
                  }
                  placeholder="2027 AEP Sales Incentive"
                  onChange={(e) =>
                    updateForm(
                      "incentive_name",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="admin-field admin-field-full">
                <label>
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  placeholder="Describe the incentive..."
                  onChange={(e) =>
                    updateForm(
                      "description",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="admin-field">
                <label>
                  Start Date
                </label>

                <input
                  type="date"
                  value={
                    form.start_date
                  }
                  onChange={(e) =>
                    updateForm(
                      "start_date",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="admin-field">
                <label>
                  End Date
                </label>

                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    updateForm(
                      "end_date",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="admin-incentive-card">
            <div className="admin-tier-header">
              <div>
                <span>
                  PAYOUT STRUCTURE
                </span>

                <h4>
                  Incentive Tiers
                </h4>
              </div>

              <button
                type="button"
                onClick={addTier}
              >
                + Add Tier
              </button>
            </div>

            {tiers.length === 0 ? (
              <div className="admin-no-tiers">
                <strong>
                  No tiers yet.
                </strong>

                <span>
                  Add your first payout
                  level.
                </span>

                <button
                  type="button"
                  onClick={addTier}
                >
                  + Add First Tier
                </button>
              </div>
            ) : (
              <div className="admin-tier-table-wrap">
                <table className="admin-tier-table">
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>
                        Required Submits
                      </th>
                      <th>
                        Earned Amount
                      </th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {tiers.map(
                      (tier, index) => (
                        <tr
                          key={
                            tier.id ||
                            `new-${index}`
                          }
                        >
                          <td>
                            <input
                              type="text"
                              value={
                                tier.tier_name
                              }
                              placeholder={`Tier ${
                                index + 1
                              }`}
                              onChange={(
                                e
                              ) =>
                                updateTier(
                                  index,
                                  "tier_name",
                                  e.target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                tier.required_submits
                              }
                              placeholder="80"
                              onChange={(
                                e
                              ) =>
                                updateTier(
                                  index,
                                  "required_submits",
                                  e.target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <div className="admin-money-input">
                              <span>$</span>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  tier.earned_amount
                                }
                                placeholder="500"
                                onChange={(
                                  e
                                ) =>
                                  updateTier(
                                    index,
                                    "earned_amount",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="admin-delete-tier"
                              onClick={() =>
                                removeTier(
                                  index
                                )
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="admin-incentive-save">
              <button
                type="button"
                onClick={
                  saveIncentive
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Incentive"}
              </button>
            </div>
          </div>

          <div className="admin-incentive-note">
            <strong>
              UNOFFICIAL PERFORMANCE
              TRACKER
            </strong>

            <p>
              Incentive progress and
              earnings displayed in the
              Lion Nation Portal are
              unofficial. Final eligibility,
              earnings and payouts are
              subject to verification
              through official company
              reporting and Finance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}