
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./AdminIncentiveGroups.css";

const blankTier = {
  tier_name: "",
  required_submits: "",
  earned_amount: "",
};

export default function AdminIncentiveGroups() {
  const [incentives, setIncentives] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [members, setMembers] = useState([]);
  const [agents, setAgents] = useState([]);

  const [selectedIncentive, setSelectedIncentive] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupName, setGroupName] = useState("");
  const [tierForm, setTierForm] = useState(blankTier);
  const [editingTierId, setEditingTierId] = useState(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(preferredIncentive, preferredGroup) {
    setLoading(true);

    const results = await Promise.all([
      supabase.from("aep_incentives").select("*").order("start_date", {
        ascending: false,
      }),
      supabase.from("aep_incentive_groups").select("*").order("display_order"),
      supabase.from("aep_incentive_tiers").select("*").order("display_order"),
      supabase.from("aep_incentive_group_members").select("*"),
      supabase
        .from("aep_people")
        .select("id,first_name,last_name,team_id,is_active,role")
        .eq("role", "agent")
        .eq("is_active", true)
        .order("last_name"),
    ]);

    const failed = results.find((result) => result.error);

    if (failed) {
      setMessage(failed.error.message);
      setLoading(false);
      return;
    }

    const [incentiveRows, groupRows, tierRows, memberRows, agentRows] =
      results.map((result) => result.data || []);

    setIncentives(incentiveRows);
    setGroups(groupRows);
    setTiers(tierRows);
    setMembers(memberRows);
    setAgents(agentRows);

    const nextIncentive =
      preferredIncentive ||
      selectedIncentive ||
      incentiveRows[0]?.id ||
      "";

    const validIncentive = incentiveRows.some(
      (incentive) => incentive.id === nextIncentive
    )
      ? nextIncentive
      : incentiveRows[0]?.id || "";

    setSelectedIncentive(validIncentive);

    const availableGroups = groupRows.filter(
      (group) => group.incentive_id === validIncentive
    );

    const nextGroup =
      preferredGroup ||
      (availableGroups.some((group) => group.id === selectedGroup)
        ? selectedGroup
        : availableGroups[0]?.id || "");

    setSelectedGroup(nextGroup);
    setLoading(false);
  }

  const incentiveGroups = useMemo(
    () => groups.filter((group) => group.incentive_id === selectedIncentive),
    [groups, selectedIncentive]
  );

  const selectedGroupData = incentiveGroups.find(
    (group) => group.id === selectedGroup
  );

  const groupTiers = useMemo(
    () =>
      tiers
        .filter(
          (tier) =>
            tier.incentive_id === selectedIncentive &&
            tier.group_id === selectedGroup
        )
        .sort(
          (a, b) =>
            Number(a.required_submits) - Number(b.required_submits)
        ),
    [tiers, selectedIncentive, selectedGroup]
  );

  const legacyTiers = tiers.filter(
    (tier) =>
      tier.incentive_id === selectedIncentive && !tier.group_id
  );

  const groupMembers = members.filter(
    (member) =>
      member.incentive_id === selectedIncentive &&
      member.group_id === selectedGroup
  );

  const assignedIds = new Set(groupMembers.map((member) => member.agent_id));

  const filteredAgents = agents.filter((agent) =>
    `${agent.first_name} ${agent.last_name}`
      .toLowerCase()
      .includes(agentSearch.toLowerCase())
  );

  function assignedGroupForAgent(agentId) {
    const assignment = members.find(
      (member) =>
        member.incentive_id === selectedIncentive &&
        member.agent_id === agentId
    );

    if (!assignment) return null;

    return groups.find((group) => group.id === assignment.group_id);
  }

  async function execute(action, successMessage) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    const name = groupName.trim();

    if (!selectedIncentive || !name) {
      setMessage("Select an incentive and enter a group name.");
      return;
    }

    await execute(async () => {
      const { data, error } = await supabase.rpc(
        "admin_save_incentive_group",
        {
          p_incentive_id: selectedIncentive,
          p_group_id: null,
          p_group_name: name,
          p_display_order: incentiveGroups.length + 1,
        }
      );

      if (error) throw error;

      setGroupName("");
      await loadData(selectedIncentive, data);
    }, "Incentive group created.");
  }

  async function renameGroup() {
    if (!selectedGroupData) return;

    const name = window.prompt(
      "Enter the new group name:",
      selectedGroupData.group_name
    );

    if (name === null) return;

    if (!name.trim()) {
      setMessage("Group name cannot be empty.");
      return;
    }

    await execute(async () => {
      const { error } = await supabase.rpc(
        "admin_save_incentive_group",
        {
          p_incentive_id: selectedIncentive,
          p_group_id: selectedGroup,
          p_group_name: name.trim(),
          p_display_order: selectedGroupData.display_order,
        }
      );

      if (error) throw error;
      await loadData(selectedIncentive, selectedGroup);
    }, "Group renamed.");
  }

  async function deleteGroup() {
    if (!selectedGroupData) return;

    if (
      !window.confirm(
        `Delete ${selectedGroupData.group_name}? The group must have no tiers or assigned agents.`
      )
    ) return;

    await execute(async () => {
      const { error } = await supabase.rpc(
        "admin_delete_incentive_group",
        { p_group_id: selectedGroup }
      );

      if (error) throw error;

      setSelectedGroup("");
      await loadData(selectedIncentive, "");
    }, "Empty group deleted.");
  }

  function startEditTier(tier) {
    setEditingTierId(tier.id);
    setTierForm({
      tier_name: tier.tier_name,
      required_submits: String(tier.required_submits),
      earned_amount: String(tier.earned_amount),
    });
  }

  function resetTierForm() {
    setEditingTierId(null);
    setTierForm(blankTier);
  }

  async function saveTier(event) {
    event.preventDefault();

    if (!selectedGroup) {
      setMessage("Select a group first.");
      return;
    }

    const requiredSubmits = Number(tierForm.required_submits);
    const earnedAmount = Number(tierForm.earned_amount);

    if (
      !tierForm.tier_name.trim() ||
      tierForm.required_submits === "" ||
      tierForm.earned_amount === "" ||
      !Number.isInteger(requiredSubmits) ||
      requiredSubmits < 0 ||
      !Number.isFinite(earnedAmount) ||
      earnedAmount < 0
    ) {
      setMessage("Enter a tier name, valid submit goal, and payout.");
      return;
    }

    await execute(async () => {
      const { error } = await supabase.rpc(
        "admin_save_group_tier",
        {
          p_incentive_id: selectedIncentive,
          p_group_id: selectedGroup,
          p_tier_id: editingTierId,
          p_tier_name: tierForm.tier_name.trim(),
          p_required_submits: requiredSubmits,
          p_earned_amount: earnedAmount,
          p_display_order: editingTierId
            ? tiers.find((tier) => tier.id === editingTierId)?.display_order || 1
            : groupTiers.length + 1,
        }
      );

      if (error) throw error;

      resetTierForm();
      await loadData(selectedIncentive, selectedGroup);
    }, "Payout tier saved.");
  }

  async function deleteTier(tier) {
    if (!window.confirm(`Delete ${tier.tier_name}?`)) return;

    await execute(async () => {
      const { error } = await supabase.rpc(
        "admin_delete_incentive_tier",
        { p_tier_id: tier.id }
      );

      if (error) throw error;

      await loadData(selectedIncentive, selectedGroup);
    }, "Tier deleted.");
  }

  async function toggleAgent(agent) {
    if (!selectedGroup) return;

    const alreadyInGroup = assignedIds.has(agent.id);

    await execute(async () => {
      const { error } = alreadyInGroup
        ? await supabase.rpc("admin_unassign_incentive_group", {
            p_incentive_id: selectedIncentive,
            p_agent_id: agent.id,
          })
        : await supabase.rpc("admin_assign_incentive_group", {
            p_incentive_id: selectedIncentive,
            p_group_id: selectedGroup,
            p_agent_id: agent.id,
          });

      if (error) throw error;

      await loadData(selectedIncentive, selectedGroup);
    }, alreadyInGroup ? "Agent unassigned." : "Agent assigned.");
  }

  if (loading) {
    return <div className="ig-loading">Loading incentive groups...</div>;
  }

  return (
    <section className="ig-manager">
      <div className="ig-heading">
        <span>INCENTIVE MANAGEMENT</span>
        <h2>Groups, Tiers & Assignments</h2>
        <p>
          Customize each incentive independently. Assign agents to their
          correct group and define the submit goals and payouts.
        </p>
      </div>

      {message && (
        <div className="ig-message" role="status">
          {message}
        </div>
      )}

      <div className="ig-panel">
        <label className="ig-label">
          SELECT INCENTIVE
          <select
            value={selectedIncentive}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedIncentive(id);
              setSelectedGroup(
                groups.find((group) => group.incentive_id === id)?.id || ""
              );
              resetTierForm();
            }}
          >
            {incentives.map((incentive) => (
              <option key={incentive.id} value={incentive.id}>
                {incentive.incentive_name}
              </option>
            ))}
          </select>
        </label>

        {incentives.length === 0 && (
          <p>Create your first incentive in the Incentive Editor.</p>
        )}
      </div>

      {selectedIncentive && (
        <>
          <div className="ig-panel">
            <div className="ig-panel-heading">
              <div>
                <h3>1. Incentive Groups</h3>
                <p>Create as many groups as this incentive needs.</p>
              </div>
            </div>

            <div className="ig-group-tabs">
              {incentiveGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={
                    selectedGroup === group.id ? "ig-selected" : ""
                  }
                  onClick={() => {
                    setSelectedGroup(group.id);
                    resetTierForm();
                  }}
                >
                  {group.group_name}
                  <small>
                    {
                      members.filter(
                        (member) =>
                          member.incentive_id === selectedIncentive &&
                          member.group_id === group.id
                      ).length
                    }{" "}
                    agents
                  </small>
                </button>
              ))}
            </div>

            <div className="ig-inline-form">
              <input
                placeholder="Group name (e.g. Group 1)"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={60}
              />
              <button
                type="button"
                disabled={busy}
                onClick={createGroup}
              >
                + Create Group
              </button>
            </div>

            {selectedGroupData && (
              <div className="ig-group-actions">
                <button type="button" onClick={renameGroup} disabled={busy}>
                  Rename Selected Group
                </button>
                <button
                  type="button"
                  className="ig-danger"
                  onClick={deleteGroup}
                  disabled={busy}
                >
                  Delete Empty Group
                </button>
              </div>
            )}
          </div>

          {selectedGroupData && (
            <>
              <div className="ig-panel">
                <div className="ig-panel-heading">
                  <div>
                    <h3>2. Payout Tiers — {selectedGroupData.group_name}</h3>
                    <p>
                      Set how many MM submits are required for each payout.
                    </p>
                  </div>
                </div>

                {groupTiers.length > 0 && (
                  <div className="ig-tier-list">
                    {groupTiers.map((tier) => (
                      <div className="ig-tier-row" key={tier.id}>
                        <div>
                          <strong>{tier.tier_name}</strong>
                          <span>
                            {Number(tier.required_submits).toLocaleString()}{" "}
                            submits
                          </span>
                        </div>
                        <strong className="ig-amount">
                          ${Number(tier.earned_amount).toLocaleString()}
                        </strong>
                        <div className="ig-row-actions">
                          <button
                            type="button"
                            onClick={() => startEditTier(tier)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ig-danger"
                            disabled={busy}
                            onClick={() => deleteTier(tier)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form className="ig-tier-form" onSubmit={saveTier}>
                  <label>
                    Tier Name
                    <input
                      required
                      placeholder="Tier 1"
                      value={tierForm.tier_name}
                      onChange={(event) =>
                        setTierForm({
                          ...tierForm,
                          tier_name: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Required MM Submits
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={tierForm.required_submits}
                      onChange={(event) =>
                        setTierForm({
                          ...tierForm,
                          required_submits: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Payout ($)
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={tierForm.earned_amount}
                      onChange={(event) =>
                        setTierForm({
                          ...tierForm,
                          earned_amount: event.target.value,
                        })
                      }
                    />
                  </label>

                  <button type="submit" disabled={busy}>
                    {editingTierId ? "Save Changes" : "+ Add Tier"}
                  </button>

                  {editingTierId && (
                    <button
                      type="button"
                      className="ig-secondary"
                      onClick={resetTierForm}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="ig-panel">
                <div className="ig-panel-heading">
                  <div>
                    <h3>3. Assign Agents — {selectedGroupData.group_name}</h3>
                    <p>
                      An agent can belong to one group per incentive. Selecting
                      an agent already in another group moves them here.
                    </p>
                  </div>
                  <div className="ig-count">
                    {groupMembers.length} Assigned
                  </div>
                </div>

                <input
                  className="ig-search"
                  type="search"
                  placeholder="Search by agent name..."
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                />

                <div className="ig-agent-list">
                  {filteredAgents.map((agent) => {
                    const isAssigned = assignedIds.has(agent.id);
                    const otherGroup = assignedGroupForAgent(agent.id);

                    return (
                      <div className="ig-agent-row" key={agent.id}>
                        <div>
                          <strong>
                            {agent.first_name} {agent.last_name}
                          </strong>
                          <span>
                            {isAssigned
                              ? `Assigned to ${selectedGroupData.group_name}`
                              : otherGroup
                                ? `Currently in ${otherGroup.group_name}`
                                : "Not assigned to this incentive"}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          className={
                            isAssigned ? "ig-remove" : "ig-assign"
                          }
                          onClick={() => toggleAgent(agent)}
                        >
                          {isAssigned
                            ? "Unassign"
                            : otherGroup
                              ? "Move Here"
                              : "Assign"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {legacyTiers.length > 0 && (
            <div className="ig-legacy">
              <strong>
                {legacyTiers.length} Existing Ungrouped Tier(s)
              </strong>
              <p>
                These older tiers have been preserved. They are not included
                in the new group-specific tier lists. Review them before
                activating the new incentive calculations.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
