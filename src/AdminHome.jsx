import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import AdminIncentives from "./AdminIncentives";
import AdminRaffles from "./AdminRaffles";
import "./AdminHome.css";

export default function AdminHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [siteSummary, setSiteSummary] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const [activeSection, setActiveSection] =
    useState("teams");

  /* TEAM MANAGEMENT */

  const [editingTeam, setEditingTeam] =
    useState(null);

  const [newTeamName, setNewTeamName] =
    useState("");

  const [movingAgent, setMovingAgent] =
    useState(null);

  const [destinationTeam, setDestinationTeam] =
    useState("");

  const [editingTarget, setEditingTarget] =
    useState(null);

  const [targetValue, setTargetValue] =
    useState("");

  /* CLASSIFICATION */

  const [classifyingAgent, setClassifyingAgent] =
    useState(null);

  const [
    incentiveCategory,
    setIncentiveCategory,
  ] = useState("");

  const [raffleRole, setRaffleRole] =
    useState("");

  /* PERFORMANCE */

  const [
    performanceValues,
    setPerformanceValues,
  ] = useState({});

  const [changedAgents, setChangedAgents] =
    useState({});

  const [
    savingPerformance,
    setSavingPerformance,
  ] = useState(false);

  const [
    performanceTeamFilter,
    setPerformanceTeamFilter,
  ] = useState("all");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setLoading(true);
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

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("aep_people")
        .select("*")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        navigate("/");
        return;
      }

      setAdmin(profile);

      const [
        teamsResult,
        peopleResult,
        summaryResult,
      ] = await Promise.all([
        supabase
          .from("aep_teams")
          .select("*")
          .eq("is_active", true)
          .order("team_name"),

        supabase
          .from("aep_people")
          .select(`
            id,
            first_name,
            last_name,
            username,
            role,
            team_id,
            aep_target,
            is_active,
            incentive_category,
            raffle_role,
            current_submits,
            current_csr_transfers,
            current_productivity,
            current_enrollment_links,
            current_talk_time,
            current_conversion
          `)
          .in("role", ["agent", "leader"])
          .order("last_name"),

        supabase.rpc(
          "get_aep_team_summary"
        ),
      ]);

      if (teamsResult.error) {
        throw teamsResult.error;
      }

      if (peopleResult.error) {
        throw peopleResult.error;
      }

      if (summaryResult.error) {
        console.error(
          "Site summary error:",
          summaryResult.error
        );
      }

      const loadedPeople =
        peopleResult.data || [];

      setTeams(teamsResult.data || []);
      setPeople(loadedPeople);
      setSiteSummary(
        summaryResult.data || []
      );

      const initialPerformance = {};

      loadedPeople
        .filter(
          (person) =>
            person.role === "agent" &&
            person.is_active
        )
        .forEach((agent) => {
          initialPerformance[agent.id] = {
            submits: Number(
              agent.current_submits || 0
            ),

            csrTransfers: Number(
              agent.current_csr_transfers ||
                0
            ),

            productivity:
              agent.current_productivity ??
              "",

            enrollmentLinks: Number(
              agent.current_enrollment_links ||
                0
            ),

            talkTime: Number(
              agent.current_talk_time || 0
            ),

            conversion:
              agent.current_conversion ?? "",
          };
        });

      setPerformanceValues(
        initialPerformance
      );

      setChangedAgents({});
    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      setErrorMessage(
        "We couldn't load the Admin Command Center."
      );
    } finally {
      setLoading(false);
    }
  }

  const agents = useMemo(
    () =>
      people.filter(
        (person) =>
          person.role === "agent" &&
          person.is_active
      ),
    [people]
  );

  const leaders = useMemo(
    () =>
      people.filter(
        (person) =>
          person.role === "leader" &&
          person.is_active
      ),
    [people]
  );

  const filteredPerformanceAgents =
    useMemo(() => {
      if (
        performanceTeamFilter === "all"
      ) {
        return agents;
      }

      return agents.filter(
        (agent) =>
          agent.team_id ===
          performanceTeamFilter
      );
    }, [
      agents,
      performanceTeamFilter,
    ]);

  const siteTarget = siteSummary.reduce(
    (total, team) =>
      total +
      Number(team.team_target || 0),
    0
  );

  const siteSubmits =
    siteSummary.reduce(
      (total, team) =>
        total +
        Number(
          team.total_submits || 0
        ),
      0
    );

  const siteRemaining = Math.max(
    siteTarget - siteSubmits,
    0
  );

  const siteProgress =
    siteTarget > 0
      ? (
          (siteSubmits / siteTarget) *
          100
        ).toFixed(1)
      : "0.0";

  function getTeamName(teamId) {
    return (
      teams.find(
        (team) => team.id === teamId
      )?.team_name || "Unassigned"
    );
  }

  function getTeamLeader(teamId) {
    const leader = leaders.find(
      (person) =>
        person.team_id === teamId
    );

    if (!leader) {
      return "No Leader Assigned";
    }

    return `${leader.first_name} ${leader.last_name}`;
  }

  function getTeamAgents(teamId) {
    return agents.filter(
      (agent) =>
        agent.team_id === teamId
    );
  }

  function getSummary(teamId) {
    return siteSummary.find(
      (summary) =>
        summary.team_id === teamId
    );
  }

  function formatIncentiveCategory(
    category
  ) {
    if (category === "2026_hire") {
      return "2026 Hire";
    }

    if (
      category === "everyone_else"
    ) {
      return "Everyone Else";
    }

    return "Not Set";
  }

  /* RENAME TEAM */

  function openRenameTeam(team) {
    setNotice("");
    setEditingTeam(team);
    setNewTeamName(team.team_name);
  }

  async function saveTeamName() {
    const cleanName =
      newTeamName.trim();

    if (!cleanName) {
      setNotice(
        "Please enter a team name."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_rename_team",
        {
          p_team_id: editingTeam.id,
          p_new_team_name:
            cleanName,
        }
      );

    if (error) {
      setNotice(error.message);
      return;
    }

    setEditingTeam(null);
    setNewTeamName("");

    await loadAdmin();

    setNotice(
      `Team renamed to ${cleanName}.`
    );
  }

  /* MOVE AGENT */

  function openMoveAgent(agent) {
    setNotice("");
    setMovingAgent(agent);

    setDestinationTeam(
      agent.team_id || ""
    );
  }

  async function saveAgentMove() {
    if (!destinationTeam) {
      setNotice(
        "Please choose a destination team."
      );
      return;
    }

    if (
      destinationTeam ===
      movingAgent.team_id
    ) {
      setNotice(
        "Please choose a different team."
      );
      return;
    }

    const oldTeam = getTeamName(
      movingAgent.team_id
    );

    const newTeam = getTeamName(
      destinationTeam
    );

    const { error } =
      await supabase.rpc(
        "admin_move_agent",
        {
          p_agent_id:
            movingAgent.id,

          p_new_team_id:
            destinationTeam,
        }
      );

    if (error) {
      setNotice(error.message);
      return;
    }

    const agentName =
      `${movingAgent.first_name} ${movingAgent.last_name}`;

    setMovingAgent(null);
    setDestinationTeam("");

    await loadAdmin();

    setNotice(
      `${agentName} moved from ${oldTeam} to ${newTeam}.`
    );
  }

  /* TARGET */

  function openTargetEditor(agent) {
    setNotice("");
    setEditingTarget(agent);

    setTargetValue(
      String(agent.aep_target ?? 0)
    );
  }

  async function saveTarget() {
    const newTarget =
      Number(targetValue);

    if (
      !Number.isInteger(newTarget) ||
      newTarget < 0
    ) {
      setNotice(
        "AEP target must be a whole number of 0 or greater."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_update_agent_target",
        {
          p_agent_id:
            editingTarget.id,

          p_new_target:
            newTarget,
        }
      );

    if (error) {
      setNotice(error.message);
      return;
    }

    const agentName =
      `${editingTarget.first_name} ${editingTarget.last_name}`;

    setEditingTarget(null);
    setTargetValue("");

    await loadAdmin();

    setNotice(
      `${agentName}'s AEP target is now ${newTarget}.`
    );
  }

  /* CLASSIFICATION */

  function openClassification(agent) {
    setNotice("");

    setClassifyingAgent(agent);

    setIncentiveCategory(
      agent.incentive_category ||
        "everyone_else"
    );

    setRaffleRole(
      agent.raffle_role || ""
    );
  }

  async function saveClassification() {
    if (!raffleRole) {
      setNotice(
        "Choose BAT, BA or SBA for this agent."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_update_agent_classification",
        {
          p_agent_id:
            classifyingAgent.id,

          p_incentive_category:
            incentiveCategory,

          p_raffle_role:
            raffleRole,
        }
      );

    if (error) {
      setNotice(error.message);
      return;
    }

    const name =
      `${classifyingAgent.first_name} ${classifyingAgent.last_name}`;

    setClassifyingAgent(null);

    await loadAdmin();

    setNotice(
      `${name}'s classifications were updated.`
    );
  }

  /* PERFORMANCE */

  function updatePerformance(
    agentId,
    field,
    value
  ) {
    setPerformanceValues(
      (current) => ({
        ...current,

        [agentId]: {
          ...current[agentId],
          [field]: value,
        },
      })
    );

    setChangedAgents(
      (current) => ({
        ...current,
        [agentId]: true,
      })
    );
  }

  async function savePerformance() {
    const ids =
      Object.keys(changedAgents);

    if (ids.length === 0) {
      setNotice(
        "No performance changes to save."
      );
      return;
    }

    setSavingPerformance(true);
    setNotice("");

    try {
      for (const agentId of ids) {
        const values =
          performanceValues[
            agentId
          ];

        const submits = Number(
          values.submits
        );

        const csrTransfers =
          Number(
            values.csrTransfers
          );

        const enrollmentLinks =
          Number(
            values.enrollmentLinks
          );

        const talkTime = Number(
          values.talkTime
        );

        const productivity =
          values.productivity === "" ||
          values.productivity === null
            ? null
            : Number(
                values.productivity
              );

        const conversion =
          values.conversion === "" ||
          values.conversion === null
            ? null
            : Number(
                values.conversion
              );

        if (
          !Number.isInteger(
            submits
          ) ||
          submits < 0 ||
          !Number.isInteger(
            csrTransfers
          ) ||
          csrTransfers < 0 ||
          !Number.isInteger(
            enrollmentLinks
          ) ||
          enrollmentLinks < 0 ||
          !Number.isFinite(
            talkTime
          ) ||
          talkTime < 0 ||
          (productivity !== null &&
            (!Number.isFinite(
              productivity
            ) ||
              productivity < 0)) ||
          (conversion !== null &&
            (!Number.isFinite(
              conversion
            ) ||
              conversion < 0))
        ) {
          throw new Error(
            "Please check the performance values before saving."
          );
        }

        const { error } =
          await supabase.rpc(
            "update_agent_current_performance",
            {
              p_agent_id:
                agentId,

              p_current_submits:
                submits,

              p_current_csr_transfers:
                csrTransfers,

              p_current_productivity:
                productivity,

              p_current_enrollment_links:
                enrollmentLinks,

              p_current_talk_time:
                talkTime,

              p_current_conversion:
                conversion,
            }
          );

        if (error) {
          throw error;
        }
      }

      await loadAdmin();

      setNotice(
        `${ids.length} agent${
          ids.length === 1
            ? ""
            : "s"
        } updated successfully.`
      );
    } catch (error) {
      console.error(
        "Performance save error:",
        error
      );

      setNotice(
        error.message ||
          "Performance could not be saved."
      );
    } finally {
      setSavingPerformance(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <img
          src="/Lion Nation.png"
          alt="Lion Nation"
        />

        <p>
          Loading Admin Command
          Center...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="admin-loading">
        <img
          src="/Lion Nation.png"
          alt="Lion Nation"
        />

        <p>{errorMessage}</p>

        <button
          type="button"
          onClick={loadAdmin}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="admin-command-center">
      <header className="admin-header">
        <div className="admin-brand">
          <img
            src="/Lion Nation.png"
            alt="Lion Nation"
          />

          <div>
            <span>LION NATION</span>

            <h1>
              Admin Command Center
            </h1>
          </div>
        </div>

        <div className="admin-header-actions">
          <span>
            {admin?.first_name}
          </span>

          <button
            type="button"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-hero">
          <div>
            <p>AEP CONTROL CENTER</p>

            <h2>
              Lion Nation Performance HQ
            </h2>

            <span>
              Manage teams, people,
              performance, incentives
              and AEP engagement from
              one place.
            </span>
          </div>

          <div className="admin-hero-progress">
            <span>
              SITE PROGRESS
            </span>

            <strong>
              {siteProgress}%
            </strong>
          </div>
        </section>

        {notice && (
          <div className="admin-notice">
            {notice}
          </div>
        )}

        <section className="admin-stat-grid">
          <article>
            <span>
              SITE AEP TARGET
            </span>

            <strong>
              {siteTarget.toLocaleString()}
            </strong>
          </article>

          <article>
            <span>
              CURRENT SUBMITS
            </span>

            <strong>
              {siteSubmits.toLocaleString()}
            </strong>
          </article>

          <article>
            <span>REMAINING</span>

            <strong>
              {siteRemaining.toLocaleString()}
            </strong>
          </article>

          <article>
            <span>
              ACTIVE AGENTS
            </span>

            <strong>
              {agents.length}
            </strong>
          </article>
        </section>

        <nav className="admin-control-nav">
          <button
            type="button"
            className={
              activeSection ===
              "teams"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "teams"
              )
            }
          >
            People & Teams
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "performance"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "performance"
              )
            }
          >
            Performance
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "incentives"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "incentives"
              )
            }
          >
            Incentives
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "raffles"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "raffles"
              )
            }
          >
            Raffles
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "suggestions"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "suggestions"
              )
            }
          >
            Suggestions
          </button>
        </nav>

        {/* PEOPLE & TEAMS */}

        {activeSection ===
          "teams" && (
          <section className="admin-section">
            <div className="admin-section-heading">
              <p>
                PEOPLE & TEAMS
              </p>

              <h3>
                Team Management
              </h3>

              <span>
                Rename teams, move
                agents, manage targets
                and assign agent
                classifications.
              </span>
            </div>

            <div className="admin-team-grid">
              {teams.map((team) => {
                const teamAgents =
                  getTeamAgents(
                    team.id
                  );

                const summary =
                  getSummary(
                    team.id
                  );

                return (
                  <article
                    className="admin-team-card"
                    key={team.id}
                  >
                    <div className="admin-team-top">
                      <div>
                        <span>
                          TEAM
                        </span>

                        <h4>
                          {
                            team.team_name
                          }
                        </h4>

                        <p>
                          Leader:{" "}
                          <strong>
                            {getTeamLeader(
                              team.id
                            )}
                          </strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openRenameTeam(
                            team
                          )
                        }
                      >
                        Rename Team
                      </button>
                    </div>

                    <div className="admin-team-stats">
                      <div>
                        <span>
                          AGENTS
                        </span>

                        <strong>
                          {
                            teamAgents.length
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          TARGET
                        </span>

                        <strong>
                          {Number(
                            summary?.team_target ||
                              0
                          ).toLocaleString()}
                        </strong>
                      </div>

                      <div>
                        <span>
                          SUBMITS
                        </span>

                        <strong>
                          {Number(
                            summary?.total_submits ||
                              0
                          ).toLocaleString()}
                        </strong>
                      </div>

                      <div>
                        <span>
                          PROGRESS
                        </span>

                        <strong>
                          {Number(
                            summary?.progress_percent ||
                              0
                          ).toFixed(
                            1
                          )}
                          %
                        </strong>
                      </div>
                    </div>

                    <div className="admin-roster">
                      <div className="admin-roster-heading">
                        <span>
                          AGENT
                        </span>

                        <span>
                          TARGET
                        </span>

                        <span>
                          SUBMITS
                        </span>

                        <span>
                          ACTIONS
                        </span>
                      </div>

                      {teamAgents.map(
                        (agent) => (
                          <div
                            className="admin-agent-row"
                            key={
                              agent.id
                            }
                          >
                            <div>
                              <strong>
                                {
                                  agent.first_name
                                }{" "}
                                {
                                  agent.last_name
                                }
                              </strong>

                              <span>
                                @
                                {
                                  agent.username
                                }{" "}
                                •{" "}
                                {agent.raffle_role ||
                                  "No Role"}
                              </span>
                            </div>

                            <strong>
                              {Number(
                                agent.aep_target ||
                                  0
                              ).toLocaleString()}
                            </strong>

                            <strong>
                              {Number(
                                agent.current_submits ||
                                  0
                              ).toLocaleString()}
                            </strong>

                            <div className="admin-row-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  openTargetEditor(
                                    agent
                                  )
                                }
                              >
                                Target
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openMoveAgent(
                                    agent
                                  )
                                }
                              >
                                Move
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openClassification(
                                    agent
                                  )
                                }
                              >
                                Class
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* PERFORMANCE */}

        {activeSection ===
          "performance" && (
          <section className="admin-section">
            <div className="admin-section-heading admin-performance-heading">
              <div>
                <p>
                  PERFORMANCE MANAGEMENT
                </p>

                <h3>
                  Current AEP
                  Performance
                </h3>

                <span>
                  One performance
                  source feeds agent
                  progress, incentives
                  and raffle tracking.
                </span>
              </div>

              <div className="admin-performance-controls">
                <select
                  value={
                    performanceTeamFilter
                  }
                  onChange={(e) =>
                    setPerformanceTeamFilter(
                      e.target
                        .value
                    )
                  }
                >
                  <option value="all">
                    All Teams
                  </option>

                  {teams.map(
                    (team) => (
                      <option
                        value={
                          team.id
                        }
                        key={
                          team.id
                        }
                      >
                        {
                          team.team_name
                        }
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  onClick={
                    savePerformance
                  }
                  disabled={
                    savingPerformance
                  }
                >
                  {savingPerformance
                    ? "Saving..."
                    : "Save Changes"}
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
                    <th>Submits</th>
                    <th>CSR</th>
                    <th>
                      Productivity %
                    </th>
                    <th>
                      Enrollment Links
                    </th>
                    <th>
                      Talk Time
                    </th>
                    <th>
                      Conversion %
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPerformanceAgents.map(
                    (agent) => {
                      const values =
                        performanceValues[
                          agent.id
                        ] || {};

                      const changed =
                        changedAgents[
                          agent.id
                        ];

                      return (
                        <tr
                          key={
                            agent.id
                          }
                          className={
                            changed
                              ? "admin-performance-changed"
                              : ""
                          }
                        >
                          <td>
                            <strong>
                              {
                                agent.first_name
                              }{" "}
                              {
                                agent.last_name
                              }
                            </strong>

                            {changed && (
                              <span className="admin-unsaved">
                                UNSAVED
                              </span>
                            )}
                          </td>

                          <td>
                            {getTeamName(
                              agent.team_id
                            )}
                          </td>

                          <td>
                            {agent.raffle_role ||
                              "—"}
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                values.submits ??
                                0
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "submits",
                                  e
                                    .target
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
                                values.csrTransfers ??
                                0
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "csrTransfers",
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                values.productivity ??
                                ""
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "productivity",
                                  e
                                    .target
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
                                values.enrollmentLinks ??
                                0
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "enrollmentLinks",
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                values.talkTime ??
                                0
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "talkTime",
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                values.conversion ??
                                ""
                              }
                              onChange={(e) =>
                                updatePerformance(
                                  agent.id,
                                  "conversion",
                                  e
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* INCENTIVES */}

        {activeSection ===
          "incentives" && (
          <AdminIncentives />
        )}

        {/* RAFFLES */}

        {activeSection ===
          "raffles" && (
          <AdminRaffles />
        )}

        {/* SUGGESTIONS */}

        {activeSection ===
          "suggestions" && (
          <section className="admin-section">
            <div className="admin-section-heading">
              <p>
                SUGGESTIONS
              </p>

              <h3>
                Suggestion Management
              </h3>

              <span>
                Review and manage
                Lion Nation
                suggestions.
              </span>
            </div>
          </section>
        )}
      </main>

      {/* RENAME TEAM */}

      {editingTeam && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <span className="admin-modal-label">
              TEAM MANAGEMENT
            </span>

            <h3>
              Rename{" "}
              {
                editingTeam.team_name
              }
            </h3>

            <label>
              Team Name
            </label>

            <input
              type="text"
              value={
                newTeamName
              }
              maxLength={60}
              onChange={(e) =>
                setNewTeamName(
                  e.target.value
                )
              }
            />

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() =>
                  setEditingTeam(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm"
                onClick={
                  saveTeamName
                }
              >
                Save Team Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE AGENT */}

      {movingAgent && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <span className="admin-modal-label">
              MOVE AGENT
            </span>

            <h3>
              {
                movingAgent.first_name
              }{" "}
              {
                movingAgent.last_name
              }
            </h3>

            <div className="admin-move-summary">
              <span>
                CURRENT TEAM
              </span>

              <strong>
                {getTeamName(
                  movingAgent.team_id
                )}
              </strong>
            </div>

            <label>
              Move To
            </label>

            <select
              value={
                destinationTeam
              }
              onChange={(e) =>
                setDestinationTeam(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Team
              </option>

              {teams.map(
                (team) => (
                  <option
                    key={
                      team.id
                    }
                    value={
                      team.id
                    }
                  >
                    {
                      team.team_name
                    }
                  </option>
                )
              )}
            </select>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() =>
                  setMovingAgent(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm"
                onClick={
                  saveAgentMove
                }
              >
                Move Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TARGET */}

      {editingTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <span className="admin-modal-label">
              AEP TARGET
            </span>

            <h3>
              {
                editingTarget.first_name
              }{" "}
              {
                editingTarget.last_name
              }
            </h3>

            <label>
              AEP Target
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={
                targetValue
              }
              onChange={(e) =>
                setTargetValue(
                  e.target.value
                )
              }
            />

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() =>
                  setEditingTarget(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm"
                onClick={
                  saveTarget
                }
              >
                Update Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLASSIFICATION */}

      {classifyingAgent && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <span className="admin-modal-label">
              AGENT CLASSIFICATION
            </span>

            <h3>
              {
                classifyingAgent.first_name
              }{" "}
              {
                classifyingAgent.last_name
              }
            </h3>

            <p>
              Incentive and raffle
              classifications are
              managed separately.
            </p>

            <label>
              Incentive Category
            </label>

            <select
              value={
                incentiveCategory
              }
              onChange={(e) =>
                setIncentiveCategory(
                  e.target.value
                )
              }
            >
              <option value="2026_hire">
                2026 Hire
              </option>

              <option value="everyone_else">
                Everyone Else
              </option>
            </select>

            <label>
              Raffle Role
            </label>

            <select
              value={
                raffleRole
              }
              onChange={(e) =>
                setRaffleRole(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Role
              </option>

              <option value="BAT">
                BAT
              </option>

              <option value="BA">
                BA
              </option>

              <option value="SBA">
                SBA
              </option>
            </select>

            <div className="admin-move-summary">
              <span>
                INCENTIVE GROUP
              </span>

              <strong>
                {formatIncentiveCategory(
                  incentiveCategory
                )}
              </strong>
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel"
                onClick={() =>
                  setClassifyingAgent(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm"
                onClick={
                  saveClassification
                }
              >
                Save Classification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}