

import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "./supabase";

import AdminAgentManagement from "./AdminAgentManagement";

import AdminAddAgent from "./AdminAddAgent";

import AdminIncentivesWorkspace from "./AdminIncentivesWorkspace";

import AdminRafflesWorkspace from "./AdminRafflesWorkspace";

import "./AdminHome.css";

import "./AdminAddAgent.css";



export default function AdminHome() {

  const navigate = useNavigate();



  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [admin, setAdmin] = useState(null);

  const [teams, setTeams] = useState([]);

  const [people, setPeople] = useState([]);

  const [siteSummary, setSiteSummary] = useState([]);

  const [errorMessage, setErrorMessage] = useState("");

  const [notice, setNotice] = useState("");

  const [activeSection, setActiveSection] = useState("teams");

  const [showAddAgent, setShowAddAgent] = useState(false);

  const [rosterVersion, setRosterVersion] = useState(0);



  const [editingTeam, setEditingTeam] = useState(null);

  const [newTeamName, setNewTeamName] = useState("");

  const [renamingTeam, setRenamingTeam] = useState(false);



  const [performanceValues, setPerformanceValues] = useState({});

  const [changedAgents, setChangedAgents] = useState({});

  const [savingPerformance, setSavingPerformance] = useState(false);

  const [performanceTeamFilter, setPerformanceTeamFilter] = useState("all");



  useEffect(() => {

    loadAdmin(true);

  }, []);



  async function loadAdmin(initial = false) {

    if (initial) setLoading(true);

    else setRefreshing(true);



    setErrorMessage("");



    try {

      const {

        data: { user },

        error: userError,

      } = await supabase.auth.getUser();



      if (userError || !user) {

        navigate("/");

        return;

      }



      const { data: profile, error: profileError } = await supabase

        .from("aep_people")

        .select("*")

        .eq("auth_user_id", user.id)

        .eq("is_active", true)

        .maybeSingle();



      if (profileError) throw profileError;



      if (!profile || profile.role !== "admin") {

        navigate("/");

        return;

      }



      setAdmin(profile);



      const [teamsResult, peopleResult, summaryResult] = await Promise.all([

        supabase

          .from("aep_teams")

          .select("*")

          .eq("is_active", true)

          .order("team_name"),



        supabase

          .from("aep_people")

          .select("*")

          .in("role", ["agent", "leader"])

          .order("last_name"),



        supabase.rpc("get_aep_team_summary"),

      ]);



      if (teamsResult.error) throw teamsResult.error;

      if (peopleResult.error) throw peopleResult.error;

      if (summaryResult.error) throw summaryResult.error;



      const loadedPeople = peopleResult.data || [];



      setTeams(teamsResult.data || []);

      setPeople(loadedPeople);

      setSiteSummary(summaryResult.data || []);



      const initialPerformance = {};



      loadedPeople

        .filter((person) => person.role === "agent" && person.is_active)

        .forEach((agent) => {

          initialPerformance[agent.id] = {

            submits: agent.current_submits ?? 0,

            csrTransfers: agent.current_csr_transfers ?? 0,

            productivity: agent.current_productivity ?? "",

            enrollmentLinks: agent.current_enrollment_links ?? 0,

            talkTime: agent.current_talk_time ?? 0,

            conversion: agent.current_conversion ?? "",

          };

        });



      setPerformanceValues(initialPerformance);

      setChangedAgents({});

    } catch (error) {

      console.error("Admin load error:", error);

      setErrorMessage(error.message || "Unable to load Admin Portal.");

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }



  const agents = useMemo(

    () => people.filter((person) => person.role === "agent" && person.is_active),

    [people]

  );



  const leaders = useMemo(

    () => people.filter((person) => person.role === "leader" && person.is_active),

    [people]

  );



  const filteredPerformanceAgents = useMemo(

    () =>

      performanceTeamFilter === "all"

        ? agents

        : agents.filter((agent) => agent.team_id === performanceTeamFilter),

    [agents, performanceTeamFilter]

  );



  const siteTarget = siteSummary.reduce(

    (total, team) => total + Number(team.team_target || 0),

    0

  );



  const siteSubmits = siteSummary.reduce(

    (total, team) => total + Number(team.total_submits || 0),

    0

  );



  const siteRemaining = Math.max(siteTarget - siteSubmits, 0);



  const siteProgress =

    siteTarget > 0 ? ((siteSubmits / siteTarget) * 100).toFixed(1) : "0.0";



  function getTeamName(teamId) {

    return teams.find((team) => team.id === teamId)?.team_name || "Unassigned";

  }



  function getTeamLeader(teamId) {

    const leader = leaders.find((person) => person.team_id === teamId);



    return leader

      ? `${leader.first_name} ${leader.last_name}`

      : "No Leader Assigned";

  }



  function getSummary(teamId) {

    return siteSummary.find((summary) => summary.team_id === teamId);

  }



  async function handleRosterChanged() {

    await loadAdmin(false);

    setRosterVersion((current) => current + 1);

  }



  async function handleAgentCreated() {

    setShowAddAgent(false);

    await handleRosterChanged();

    setNotice("New agent account created. The roster has been refreshed.");

  }



  function updatePerformance(agentId, field, value) {

    setPerformanceValues((current) => ({

      ...current,

      [agentId]: {

        ...current[agentId],

        [field]: value,

      },

    }));



    setChangedAgents((current) => ({

      ...current,

      [agentId]: true,

    }));

  }



  async function savePerformance() {

    const ids = Object.keys(changedAgents);



    if (!ids.length) {

      setNotice("No performance changes to save.");

      return;

    }



    setSavingPerformance(true);

    setNotice("");



    let savedCount = 0;



    try {

      for (const agentId of ids) {

        const values = performanceValues[agentId];



        const submits = Number(values.submits);

        const csrTransfers = Number(values.csrTransfers);

        const enrollmentLinks = Number(values.enrollmentLinks);

        const talkTime = Number(values.talkTime);



        const productivity =

          values.productivity === "" || values.productivity == null

            ? null

            : Number(values.productivity);



        const conversion =

          values.conversion === "" || values.conversion == null

            ? null

            : Number(values.conversion);



        const wholeNumbers = [submits, csrTransfers, enrollmentLinks];

        const decimalNumbers = [talkTime, productivity, conversion];



        if (

          wholeNumbers.some((value) => !Number.isInteger(value) || value < 0) ||

          decimalNumbers.some(

            (value) =>

              value !== null &&

              (!Number.isFinite(value) || value < 0)

          )

        ) {

          throw new Error("Enter valid nonnegative performance values.");

        }



        const { error } = await supabase.rpc(

          "update_agent_current_performance",

          {

            p_agent_id: agentId,

            p_current_submits: submits,

            p_current_csr_transfers: csrTransfers,

            p_current_productivity: productivity,

            p_current_enrollment_links: enrollmentLinks,

            p_current_talk_time: talkTime,

            p_current_conversion: conversion,

          }

        );



        if (error) throw error;

        savedCount++;

      }



      await loadAdmin(false);

      setNotice(`${savedCount} agent(s) updated successfully.`);

    } catch (error) {

      console.error("Performance save error:", error);

      await loadAdmin(false);

      setNotice(

        `${savedCount} agent(s) saved before an error occurred. ${error.message}`

      );

    } finally {

      setSavingPerformance(false);

    }

  }



  async function saveTeamName() {

    if (!editingTeam || !newTeamName.trim()) {

      setNotice("Enter a valid team name.");

      return;

    }



    setRenamingTeam(true);



    const { error } = await supabase.rpc("admin_rename_team", {

      p_team_id: editingTeam.id,

      p_new_team_name: newTeamName.trim(),

    });



    setRenamingTeam(false);



    if (error) {

      setNotice(error.message);

      return;

    }



    setEditingTeam(null);

    setNewTeamName("");

    await handleRosterChanged();

    setNotice("Team renamed successfully.");

  }



  async function handleLogout() {

    await supabase.auth.signOut();

    navigate("/");

  }



  if (loading) {

    return (

      <div className="admin-loading">

        <img src="/Lion Nation.png" alt="Lion Nation" />

        <p>Loading Admin Command Center...</p>

      </div>

    );

  }



  if (errorMessage) {

    return (

      <div className="admin-loading">

        <p>{errorMessage}</p>

        <button type="button" onClick={() => loadAdmin(true)}>

          Try Again

        </button>

      </div>

    );

  }



  return (

    <div className="admin-command-center">

      <header className="admin-header">

        <div className="admin-brand">

          <img src="/Lion Nation.png" alt="Lion Nation" />

          <div>

            <span>LION NATION</span>

            <h1>Admin Command Center</h1>

          </div>

        </div>



        <div className="admin-header-actions">

          <span>{admin?.first_name}</span>

          <button type="button" onClick={handleLogout}>

            Sign Out

          </button>

        </div>

      </header>



      <main className="admin-main">

        <section className="admin-hero">

          <div>

            <p>AEP CONTROL CENTER</p>

            <h2>Lion Nation Performance HQ</h2>

            <span>

              Manage your teams, performance, incentives, and raffles.

            </span>

          </div>



          <div className="admin-hero-progress">

            <span>SITE PROGRESS</span>

            <strong>{siteProgress}%</strong>

          </div>

        </section>



        {notice && <div className="admin-notice">{notice}</div>}



        <section className="admin-stat-grid">

          <article>

            <span>SITE AEP TARGET</span>

            <strong>{siteTarget.toLocaleString()}</strong>

          </article>



          <article>

            <span>CURRENT SUBMITS</span>

            <strong>{siteSubmits.toLocaleString()}</strong>

          </article>



          <article>

            <span>REMAINING</span>

            <strong>{siteRemaining.toLocaleString()}</strong>

          </article>



          <article>

            <span>ACTIVE AGENTS</span>

            <strong>{agents.length}</strong>

          </article>

        </section>



        <nav className="admin-control-nav">

          {[

            ["teams", "People & Teams"],

            ["performance", "Performance"],

            ["incentives", "Incentives"],

            ["raffles", "Raffles"],

            ["suggestions", "Suggestions"],

          ].map(([key, label]) => (

            <button

              key={key}

              type="button"

              className={activeSection === key ? "active" : ""}

              onClick={() => setActiveSection(key)}

            >

              {label}

            </button>

          ))}

        </nav>



        {activeSection === "teams" && (

          <section className="admin-section">

            <div className="admin-section-heading">

              <p>PEOPLE & TEAMS</p>

              <h3>Site Team Overview</h3>

            </div>



            <div className="admin-team-grid">

              {teams.map((team) => {

                const summary = getSummary(team.id);



                return (

                  <article className="admin-team-card" key={team.id}>

                    <div className="admin-team-top">

                      <div>

                        <span>TEAM</span>

                        <h4>{team.team_name}</h4>

                        <p>

                          Leader: <strong>{getTeamLeader(team.id)}</strong>

                        </p>

                      </div>



                      <button

                        type="button"

                        onClick={() => {

                          setEditingTeam(team);

                          setNewTeamName(team.team_name);

                        }}

                      >

                        Rename Team

                      </button>

                    </div>



                    <div className="admin-team-stats">

                      <div>

                        <span>AGENTS</span>

                        <strong>

                          {agents.filter((a) => a.team_id === team.id).length}

                        </strong>

                      </div>



                      <div>

                        <span>TARGET</span>

                        <strong>

                          {Number(summary?.team_target || 0).toLocaleString()}

                        </strong>

                      </div>



                      <div>

                        <span>SUBMITS</span>

                        <strong>

                          {Number(summary?.total_submits || 0).toLocaleString()}

                        </strong>

                      </div>



                      <div>

                        <span>PROGRESS</span>

                        <strong>

                          {Number(summary?.progress_percent || 0).toFixed(1)}%

                        </strong>

                      </div>

                    </div>

                  </article>

                );

              })}

            </div>



            <div style={{ margin: "26px 0 18px" }}>

              <button

                type="button"

                onClick={() => setShowAddAgent((current) => !current)}

                style={{

                  padding: "14px 22px",

                  border: "none",

                  borderRadius: 10,

                  background: "#191919",

                  color: "#edc66d",

                  fontWeight: 800,

                  cursor: "pointer",

                }}

              >

                {showAddAgent ? "− Close Add Agent" : "+ Add New Agent"}

              </button>

            </div>



            {showAddAgent && (

              <AdminAddAgent

                teams={teams}

                onCreated={handleAgentCreated}

              />

            )}



            <AdminAgentManagement

              key={rosterVersion}

              teams={teams}

              onChanged={handleRosterChanged}

            />

          </section>

        )}



        {activeSection === "performance" && (

          <section className="admin-section">

            <div className="admin-section-heading admin-performance-heading">

              <div>

                <p>PERFORMANCE MANAGEMENT</p>

                <h3>Current AEP Performance</h3>

                <span>

                  Update current totals for each agent. Incentives and raffle

                  tracking use these same values.

                </span>

              </div>



              <div className="admin-performance-controls">

                <select

                  value={performanceTeamFilter}

                  onChange={(e) =>

                    setPerformanceTeamFilter(e.target.value)

                  }

                >

                  <option value="all">All Teams</option>

                  {teams.map((team) => (

                    <option key={team.id} value={team.id}>

                      {team.team_name}

                    </option>

                  ))}

                </select>



                <button

                  type="button"

                  disabled={savingPerformance || refreshing}

                  onClick={savePerformance}

                >

                  {savingPerformance ? "Saving..." : "Save Changes"}

                </button>

              </div>

            </div>



            <div className="admin-performance-table-wrap">

              <table className="admin-performance-table">

                <thead>

                  <tr>

                    <th>Agent</th>

                    <th>Team</th>

                    <th>Role</th>

                    <th>MM Submits</th>

                    <th>CSR Transfers</th>

                    <th>Productivity %</th>

                    <th>Enrollment Links</th>

                    <th>AWS Online Hours</th>

                    <th>Conversion %</th>

                  </tr>

                </thead>



                <tbody>

                  {filteredPerformanceAgents.map((agent) => {

                    const values = performanceValues[agent.id] || {};



                    return (

                      <tr

                        key={agent.id}

                        className={

                          changedAgents[agent.id]

                            ? "admin-performance-changed"

                            : ""

                        }

                      >

                        <td>

                          <strong>

                            {agent.first_name} {agent.last_name}

                          </strong>



                          {changedAgents[agent.id] && (

                            <span className="admin-unsaved">UNSAVED</span>

                          )}

                        </td>



                        <td>{getTeamName(agent.team_id)}</td>

                        <td>{agent.raffle_role || "—"}</td>



                        {[

                          ["submits", "1"],

                          ["csrTransfers", "1"],

                          ["productivity", "0.01"],

                          ["enrollmentLinks", "1"],

                          ["talkTime", "0.01"],

                          ["conversion", "0.01"],

                        ].map(([field, step]) => (

                          <td key={field}>

                            <input

                              type="number"

                              min="0"

                              step={step}

                              value={values[field] ?? ""}

                              onChange={(e) =>

                                updatePerformance(

                                  agent.id,

                                  field,

                                  e.target.value

                                )

                              }

                            />

                          </td>

                        ))}

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </section>

        )}



        {activeSection === "incentives" && <AdminIncentivesWorkspace />}

        {activeSection === "raffles" && <AdminRafflesWorkspace />}



        {activeSection === "suggestions" && (

          <section className="admin-section">

            <div className="admin-section-heading">

              <p>SUGGESTIONS</p>

              <h3>Suggestion Management</h3>

              <span>Review and manage Lion Nation suggestions.</span>

            </div>

          </section>

        )}

      </main>



      {editingTeam && (

        <div className="admin-modal-backdrop">

          <div className="admin-modal">

            <span className="admin-modal-label">TEAM MANAGEMENT</span>

            <h3>Rename {editingTeam.team_name}</h3>



            <label>Team Name</label>

            <input

              value={newTeamName}

              onChange={(e) => setNewTeamName(e.target.value)}

              maxLength={60}

            />



            <div className="admin-modal-actions">

              <button

                type="button"

                className="admin-cancel"

                onClick={() => setEditingTeam(null)}

              >

                Cancel

              </button>



              <button

                type="button"

                className="admin-confirm"

                disabled={renamingTeam}

                onClick={saveTeamName}

              >

                {renamingTeam ? "Saving..." : "Save Team Name"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}
