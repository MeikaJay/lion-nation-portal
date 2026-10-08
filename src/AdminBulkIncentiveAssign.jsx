import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const panel = { background: "#fffdf8", border: "1px solid #decda7", borderRadius: 14, padding: 20, marginTop: 18 };
const field = { padding: 11, border: "1px solid #cbbd9f", borderRadius: 9, width: "100%", background: "white", color: "#191919" };
const button = { background: "#191919", color: "#f0cb76", padding: "12px 17px", borderRadius: 9, border: "1px solid #c9a34e", cursor: "pointer", fontWeight: 700 };

export default function AdminBulkIncentiveAssign() {
  const [incentives, setIncentives] = useState([]);
  const [incentiveId, setIncentiveId] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [teamFilter, setTeamFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData(table, query) {
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    return data || [];
  }

  async function loadBase() {
    setLoading(true);
    setMessage("");
    try {
      const [i, a, t] = await Promise.all([
        fetchData("incentives", supabase.from("aep_incentives").select("id,incentive_name").order("incentive_name")),
        fetchData("agents", supabase.from("aep_people").select("id,first_name,last_name,team_id,incentive_category").eq("role", "agent").eq("is_active", true).order("first_name")),
        fetchData("teams", supabase.from("aep_teams").select("id,team_name").order("team_name")),
      ]);
      setIncentives(i);
      setAgents(a);
      setTeams(t);
      setIncentiveId(current => i.some(x => x.id === current) ? current : (i[0]?.id || ""));
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }

  async function loadAssignments(id) {
    setSelected([]);
    setGroups([]);
    setGroupId("");
    setMembers([]);
    if (!id) return;
    try {
      const [g, m] = await Promise.all([
        fetchData("groups", supabase.from("aep_incentive_groups").select("id,group_name,incentive_id").eq("incentive_id", id).order("display_order")),
        fetchData("members", supabase.from("aep_incentive_group_members").select("agent_id,group_id,incentive_id").eq("incentive_id", id)),
      ]);
      setGroups(g);
      setMembers(m);
      setGroupId(g[0]?.id || "");
    } catch (e) { setMessage(e.message); }
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadAssignments(incentiveId); }, [incentiveId]);

  const visible = useMemo(() => agents.filter(a =>
    (teamFilter === "all" || a.team_id === teamFilter) &&
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [agents, teamFilter, search]);
  const visibleIds = visible.map(a => a.id);
  const selectedSet = new Set(selected);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedSet.has(id));
  const assignedGroup = id => members.find(m => m.agent_id === id)?.group_id;
  const groupName = id => groups.find(g => g.id === id)?.group_name || "Unassigned";

  function toggleVisible() {
    setSelected(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  }

  async function assignSelected() {
    if (!incentiveId || !groupId || !selected.length || busy) return;
    const moving = selected.filter(id => assignedGroup(id) !== groupId);
    if (!moving.length) { setMessage("Everyone selected is already in that group."); return; }
    if (!window.confirm(`Assign ${moving.length} agent(s) to ${groupName(groupId)}? Existing group assignments for this incentive will be replaced.`)) return;
    setBusy(true);
    setMessage("");
    let completed = 0;
    let failure = "";
    for (const agentId of moving) {
      const { error } = await supabase.rpc("admin_assign_incentive_group", {
        p_incentive_id: incentiveId,
        p_group_id: groupId,
        p_agent_id: agentId,
      });
      if (error) { failure = error.message; break; }
      completed += 1;
    }
    await loadAssignments(incentiveId);
    setBusy(false);
    setMessage(failure ? `${completed} saved; stopped on an error: ${failure}` : `${completed} agent(s) assigned successfully.`);
  }

  return (
    <section style={panel}>
      <p style={{ color: "#8b691f", fontWeight: 800, margin: "0 0 5px" }}>BULK ASSIGNMENTS</p>
      <h3 style={{ margin: "0 0 8px" }}>Assign multiple agents at once</h3>
      <p style={{ color: "#665f53" }}>Filter, select everyone you need, and save once. Existing assignments are shown beside each name.</p>
      {message && <p role="status" style={{ padding: 12, background: "#f7eedb", borderRadius: 8 }}>{message}</p>}
      {loading ? <p>Loading agents...</p> : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, margin: "18px 0" }}>
          <label>Incentive<select style={field} value={incentiveId} onChange={e => { setMessage(""); setIncentiveId(e.target.value); }}><option value="">Select incentive</option>{incentives.map(i => <option key={i.id} value={i.id}>{i.incentive_name}</option>)}</select></label>
          <label>Assign to group<select style={field} value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Select group</option>{groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}</select></label>
          <label>Team filter<select style={field} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}><option value="all">All teams</option>{teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select></label>
          <label>Find agent<input style={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name" /></label>
        </div>
        {!groups.length && incentiveId && <p>Create a group in “Groups, Tiers & Assignments” first.</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <strong>{selected.length} selected · {visible.length} showing · {agents.length} active agents</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={button} onClick={toggleVisible} disabled={!visible.length || busy}>{allVisibleSelected ? "Deselect filtered" : "Select all filtered"}</button>
            <button type="button" style={{ ...button, background: "white", color: "#191919" }} onClick={() => setSelected([])} disabled={busy}>Clear</button>
          </div>
        </div>
        <div style={{ maxHeight: 370, overflowY: "auto", border: "1px solid #e5d8bd", borderRadius: 10 }}>
          {visible.map(a => <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderBottom: "1px solid #eee4d2", cursor: "pointer" }}>
            <input type="checkbox" checked={selectedSet.has(a.id)} onChange={e => setSelected(current => e.target.checked ? [...new Set([...current, a.id])] : current.filter(id => id !== a.id))} disabled={busy} />
            <span style={{ flex: 1, fontWeight: 650 }}>{a.first_name} {a.last_name}</span>
            <span style={{ fontSize: 12, color: "#74684f" }}>{groupName(assignedGroup(a.id))}</span>
          </label>)}
          {!visible.length && <p style={{ padding: 14 }}>No matching agents.</p>}
        </div>
        <button type="button" style={{ ...button, marginTop: 16, width: "100%", opacity: !selected.length || !groupId || busy ? 0.5 : 1 }} onClick={assignSelected} disabled={!selected.length || !groupId || busy}>{busy ? "Saving assignments..." : `Assign ${selected.length} selected agent(s) to ${groupName(groupId)}`}</button>
      </>}
    </section>
  );
}
