import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "./supabase";

import "./LeaderHome.css";
import { incentiveStatus, raffleStatus, metricLabel } from "./aepTracking";



export default function LeaderHome() {

  const navigate = useNavigate();



  const [loading, setLoading] = useState(true);

  const [savingPerformance, setSavingPerformance] = useState(false);



  const [leader, setLeader] = useState(null);

  const [team, setTeam] = useState(null);

  const [agents, setAgents] = useState([]);



  const [performanceValues, setPerformanceValues] = useState({});

  const [originalValues, setOriginalValues] = useState({});



  const [siteTeams, setSiteTeams] = useState([]);



  const [incentives, setIncentives] = useState([]);

  const [incentiveTiers, setIncentiveTiers] = useState([]);
  const [groups,setGroups] = useState([]);
  const [memberships,setMemberships] = useState([]);
  const [groupsLoaded,setGroupsLoaded] = useState(false);



  const [raffles, setRaffles] = useState([]);

  const [raffleRequirements, setRaffleRequirements] = useState([]);



  const [errorMessage, setErrorMessage] = useState("");

  const [saveMessage, setSaveMessage] = useState("");

  const [saveError, setSaveError] = useState("");



  const [suggestionSubject, setSuggestionSubject] = useState("");

  const [suggestionText, setSuggestionText] = useState("");

  const [suggestionAnonymous, setSuggestionAnonymous] = useState(false);

  const [suggestionSaving, setSuggestionSaving] = useState(false);

  const [suggestionMessage, setSuggestionMessage] = useState("");

  const [suggestionError, setSuggestionError] = useState("");



  useEffect(() => {

    loadDashboard();

  }, []);



  async function loadDashboard() {

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



      const { data: leaderProfile, error: leaderError } =

        await supabase

          .from("aep_people")

          .select(`

            id,

            first_name,

            last_name,

            username,

            role,

            team_id,

            is_active

          `)

          .eq("auth_user_id", user.id)

          .eq("is_active", true)

          .maybeSingle();



      if (leaderError) throw leaderError;



      if (!leaderProfile) {

        await supabase.auth.signOut();

        navigate("/");

        return;

      }



      if (leaderProfile.role !== "leader") {

        if (leaderProfile.role === "agent") {

          navigate("/portal");

          return;

        }



        if (leaderProfile.role === "admin") {

          navigate("/admin");

          return;

        }



        await supabase.auth.signOut();

        navigate("/");

        return;

      }



      setLeader(leaderProfile);



      const [

        teamResult,

        agentsResult,

        siteResult,

        incentivesResult,

        tiersResult,

        rafflesResult,

        requirementsResult,
      groupsResult,
      membershipsResult,

      ] = await Promise.all([

        supabase

          .from("aep_teams")

          .select("id, team_name")

          .eq("id", leaderProfile.team_id)

          .maybeSingle(),



        supabase

          .from("aep_people")

          .select(`

            id,

            first_name,

            last_name,

            username,

            aep_target,

            current_submits,

            current_csr_transfers,

            current_productivity,

            current_enrollment_links,
            current_talk_time,
            current_conversion,
            raffle_role,

            team_id

          `)

          .eq("team_id", leaderProfile.team_id)

          .eq("role", "agent")

          .eq("is_active", true)

          .order("first_name"),



        supabase.rpc("get_aep_team_summary"),



        supabase

          .from("aep_incentives")

          .select("*")

          .eq("is_active", true),



        supabase

          .from("aep_incentive_tiers")

          .select("*")

          .order("required_submits"),



        supabase

          .from("aep_raffles")

          .select("*")

          .eq("is_active", true),



        supabase

          .from("aep_raffle_requirements")

          .select("*"),
        supabase.from("aep_incentive_groups").select("*"),
        supabase.from("aep_incentive_group_members").select("*"),

      ]);



      if (teamResult.error) throw teamResult.error;

      if (agentsResult.error) throw agentsResult.error;

      if (siteResult.error) throw siteResult.error;

      if (incentivesResult.error) throw incentivesResult.error;

      if (tiersResult.error) throw tiersResult.error;

      if (rafflesResult.error) throw rafflesResult.error;

      if (requirementsResult.error) throw requirementsResult.error;



      setTeam(teamResult.data);



      const safeAgents = agentsResult.data || [];

      setAgents(safeAgents);



      const values = {};



      safeAgents.forEach((agent) => {

        values[agent.id] = {

          submits: String(agent.current_submits ?? 0),

          csrTransfers: String(agent.current_csr_transfers ?? 0),

          productivity:

            agent.current_productivity === null ||

            agent.current_productivity === undefined

              ? ""

              : String(agent.current_productivity),

          enrollmentLinks: String(

            agent.current_enrollment_links ?? 0

          ),
        talkTime: agent.current_talk_time == null ? "" : String(agent.current_talk_time),
        conversion: agent.current_conversion == null ? "" : String(agent.current_conversion),

        };

      });



      setPerformanceValues(values);

      setOriginalValues(JSON.parse(JSON.stringify(values)));



      setSiteTeams(siteResult.data || []);

      setGroups(groupsResult.data || []);
      setMemberships(membershipsResult.data || []);
      setGroupsLoaded(!groupsResult.error && !membershipsResult.error);
      setIncentives(incentivesResult.data || []);

      setIncentiveTiers(tiersResult.data || []);

      setRaffles(rafflesResult.data || []);

      setRaffleRequirements(requirementsResult.data || []);

    } catch (error) {

      console.error("Leader dashboard error:", error);



      setErrorMessage(

        "We couldn't load your Leader AEP dashboard right now."

      );

    } finally {

      setLoading(false);

    }

  }



  const teamTarget = useMemo(() => {

    return agents.reduce(

      (total, agent) => total + Number(agent.aep_target || 0),

      0

    );

  }, [agents]);



  const teamSubmits = useMemo(() => {

    return agents.reduce((total, agent) => {

      return (

        total +

        Number(performanceValues[agent.id]?.submits || 0)

      );

    }, 0);

  }, [agents, performanceValues]);



  const teamRemaining = Math.max(teamTarget - teamSubmits, 0);



  const teamProgress =

    teamTarget > 0

      ? Math.round((teamSubmits / teamTarget) * 100)

      : 0;



  const changedAgentIds = useMemo(() => {

    return agents

      .filter((agent) => {

        const current = performanceValues[agent.id];

        const original = originalValues[agent.id];



        if (!current || !original) return false;



        return (

          String(current.submits) !== String(original.submits) ||

          String(current.csrTransfers) !==

            String(original.csrTransfers) ||

          String(current.productivity) !==

            String(original.productivity) ||

          String(current.enrollmentLinks) !==

            String(original.enrollmentLinks)

        );

      })

      .map((agent) => agent.id);

  }, [agents, performanceValues, originalValues]);



  const siteTarget = useMemo(() => {

    return siteTeams.reduce(

      (total, row) => total + Number(row.team_target || 0),

      0

    );

  }, [siteTeams]);



  const siteSubmits = useMemo(() => {

    return siteTeams.reduce(

      (total, row) => total + Number(row.total_submits || 0),

      0

    );

  }, [siteTeams]);



  const siteRemaining = Math.max(siteTarget - siteSubmits, 0);



  const siteProgress =

    siteTarget > 0

      ? Math.round((siteSubmits / siteTarget) * 100)

      : 0;



  function updatePerformance(agentId, field, value) {

    let cleaned = value;



    if (["productivity", "talkTime", "conversion"].includes(field)) {

      cleaned = value.replace(/[^\d.]/g, "");



      const parts = cleaned.split(".");



      if (parts.length > 2) {

        cleaned = `${parts[0]}.${parts.slice(1).join("")}`;

      }

    } else {

      cleaned = value.replace(/[^\d]/g, "");

    }



    setPerformanceValues((current) => ({

      ...current,

      [agentId]: {

        ...current[agentId],

        [field]: cleaned,

      },

    }));



    setSaveMessage("");

    setSaveError("");

  }



  async function savePerformance() {

    setSaveMessage("");

    setSaveError("");



    if (changedAgentIds.length === 0) {

      setSaveMessage("No performance numbers have changed.");

      return;

    }



    setSavingPerformance(true);



    try {

      for (const agentId of changedAgentIds) {

        const values = performanceValues[agentId];



        const { error } = await supabase.rpc(

          "update_agent_current_performance",

          {

            p_agent_id: agentId,

            p_current_submits: Number(values.submits || 0),

            p_current_csr_transfers: Number(

              values.csrTransfers || 0

            ),

            p_current_productivity:

              values.productivity === ""

                ? null

                : Number(values.productivity),

            p_current_enrollment_links: Number(

              values.enrollmentLinks || 0

            ),
            p_current_talk_time: values.talkTime === "" ? null : Number(values.talkTime),
            p_current_conversion: values.conversion === "" ? null : Number(values.conversion),

          }

        );



        if (error) throw error;

      }



      const updatedCount = changedAgentIds.length;



      setSaveMessage(

        `${updatedCount} ${

          updatedCount === 1 ? "agent" : "agents"

        } updated successfully.`

      );



      await loadDashboard();

    } catch (error) {

      console.error("Performance update error:", error);



      setSaveError(

        "We couldn't save the performance updates. Please try again."

      );

    } finally {

      setSavingPerformance(false);

    }

  }



  function getAgentIncentive(agent, incentive) {
    return incentiveStatus({...agent,current_submits:Number(performanceValues[agent.id]?.submits || 0)},incentive,incentiveTiers,groups,memberships,groupsLoaded);
  }
  function getRaffleStatus(agent, raffle) {
    const v=performanceValues[agent.id] || {};
    return raffleStatus({...agent,current_submits:Number(v.submits || 0),current_csr_transfers:Number(v.csrTransfers || 0),current_productivity:v.productivity === '' ? null : Number(v.productivity),current_enrollment_links:Number(v.enrollmentLinks || 0),current_talk_time:v.talkTime === '' ? null : Number(v.talkTime),current_conversion:v.conversion === '' ? null : Number(v.conversion)},raffle,raffleRequirements);
  }

  async function submitSuggestion(event) {

    event.preventDefault();



    if (!suggestionText.trim()) {

      setSuggestionError("Please enter your suggestion.");

      return;

    }



    setSuggestionSaving(true);

    setSuggestionError("");

    setSuggestionMessage("");



    try {

      const { error } = await supabase

        .from("aep_suggestions")

        .insert({

          submitted_by: leader.id,

          subject: suggestionSubject.trim() || null,

          suggestion_text: suggestionText.trim(),

          is_anonymous: suggestionAnonymous,

          status: "new",

        });



      if (error) throw error;



      setSuggestionSubject("");

      setSuggestionText("");

      setSuggestionAnonymous(false);



      setSuggestionMessage(

        "Thank you! Your suggestion has been submitted."

      );

    } catch (error) {

      console.error("Suggestion error:", error);



      setSuggestionError(

        "We couldn't submit your suggestion."

      );

    } finally {

      setSuggestionSaving(false);

    }

  }



  async function handleLogout() {

    await supabase.auth.signOut();

    navigate("/");

  }



  if (loading) {

    return (

      <div className="leader-loading">

        <img src="/Lion Nation.png" alt="Lion Nation" />

        <p>Loading your Leader AEP dashboard...</p>

      </div>

    );

  }



  if (errorMessage) {

    return (

      <div className="leader-loading">

        <img src="/Lion Nation.png" alt="Lion Nation" />

        <p>{errorMessage}</p>



        <button type="button" onClick={loadDashboard}>

          Try Again

        </button>

      </div>

    );

  }



  return (

    <div className="leader-portal">

      <header className="leader-header">

        <div className="leader-brand">

          <img

            src="/Lion Nation.png"

            alt="Lion Nation"

            className="leader-logo"

          />



          <div>

            <p>LION NATION</p>

            <h1>Leader Performance Portal</h1>

          </div>

        </div>



        <button

          type="button"

          className="leader-logout"

          onClick={handleLogout}

        >

          Sign Out

        </button>

      </header>



      <main className="leader-main">

        <section className="leader-hero">

          <div>

            <p className="leader-eyebrow">

              TEAM AEP COMMAND CENTER

            </p>



            <h2>Welcome, {leader?.first_name}.</h2>



            <span>{team?.team_name}</span>

          </div>



          <div className="leader-hero-message">

            <span>LEAD THE STANDARD.</span>

            <span>COACH THE PERFORMANCE.</span>

            <strong>BUILD THE PRIDE.</strong>

          </div>

        </section>



        <section className="leader-metrics">

          <Metric

            label="TEAM AEP TARGET"

            value={teamTarget}

            detail={`${agents.length} active agents`}

          />



          <Metric

            label="TEAM SUBMITS"

            value={teamSubmits}

            detail="Current cumulative submits"

          />



          <Metric

            label="TEAM PROGRESS"

            value={`${teamProgress}%`}

            detail="Of team AEP target"

          />



          <Metric

            label="REMAINING"

            value={teamRemaining}

            detail="Submits needed to target"

          />

        </section>



        <section className="leader-card">

          <SectionTitle

            eyebrow="TEAM PERFORMANCE"

            title="Update Current Performance"

            badge={

              changedAgentIds.length > 0

                ? `${changedAgentIds.length} CHANGED`

                : `${agents.length} AGENTS`

            }

          />



          <div className="leader-callout">

            <strong>Enter where each agent currently stands.</strong>



            <p>

              These are cumulative totals. Update the current

              numbers and save. You do not need to enter

              performance day by day.

            </p>

          </div>



          <div className="leader-table-wrap">

            <table className="leader-table performance-entry-table">

              <thead>

                <tr>

                  <th>Agent</th>

                  <th>AEP Target</th>

                  <th>Sales / Submits</th>

                  <th>CSR Transfers</th>

                  <th>Productivity %</th>

                  <th>Enrollment Links</th>
                <th>AWS Online Hours</th>
                <th>Conversion %</th>

                  <th>Remaining</th>

                </tr>

              </thead>



              <tbody>

                {agents.map((agent) => {

                  const values =

                    performanceValues[agent.id] || {};



                  const target = Number(

                    agent.aep_target || 0

                  );



                  const submits = Number(

                    values.submits || 0

                  );



                  const changed =

                    changedAgentIds.includes(agent.id);



                  return (

                    <tr

                      key={agent.id}

                      className={

                        changed

                          ? "performance-row-changed"

                          : ""

                      }

                    >

                      <td>

                        <strong>

                          {agent.first_name}{" "}

                          {agent.last_name}

                        </strong>



                        {changed && (

                          <span className="unsaved-tag">

                            UNSAVED

                          </span>

                        )}

                      </td>



                      <td>

                        {target.toLocaleString()}

                      </td>



                      <td>

                        <input

                          className="leader-number-input"

                          inputMode="numeric"

                          value={values.submits ?? "0"}

                          onChange={(event) =>

                            updatePerformance(

                              agent.id,

                              "submits",

                              event.target.value

                            )

                          }

                        />

                      </td>



                      <td>

                        <input

                          className="leader-number-input"

                          inputMode="numeric"

                          value={

                            values.csrTransfers ?? "0"

                          }

                          onChange={(event) =>

                            updatePerformance(

                              agent.id,

                              "csrTransfers",

                              event.target.value

                            )

                          }

                        />

                      </td>



                      <td>

                        <div className="percent-input-wrap">

                          <input

                            className="leader-number-input"

                            inputMode="decimal"

                            placeholder="0"

                            value={

                              values.productivity ?? ""

                            }

                            onChange={(event) =>

                              updatePerformance(

                                agent.id,

                                "productivity",

                                event.target.value

                              )

                            }

                          />



                          <span>%</span>

                        </div>

                      </td>



                      <td>

                        <input

                          className="leader-number-input"

                          inputMode="numeric"

                          value={

                            values.enrollmentLinks ?? "0"

                          }

                          onChange={(event) =>

                            updatePerformance(

                              agent.id,

                              "enrollmentLinks",

                              event.target.value

                            )

                          }

                        />

                      </td>



                      {['talkTime','conversion'].map(field => <td key={field}><input className="leader-number-input" inputMode="decimal" value={values[field] ?? ''} onChange={event => updatePerformance(agent.id,field,event.target.value)} /></td>)}

                      <td>

                        <strong>

                          {Math.max(

                            target - submits,

                            0

                          ).toLocaleString()}

                        </strong>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          </div>



          {saveError && (

            <div className="leader-error">

              {saveError}

            </div>

          )}



          {saveMessage && (

            <div className="leader-success">

              {saveMessage}

            </div>

          )}



          <div className="leader-save-row">

            <span>

              <strong>{changedAgentIds.length}</strong>{" "}

              unsaved{" "}

              {changedAgentIds.length === 1

                ? "agent"

                : "agents"}

            </span>



            <button

              type="button"

              className="primary-button"

              onClick={savePerformance}

              disabled={

                savingPerformance ||

                changedAgentIds.length === 0

              }

            >

              {savingPerformance

                ? "Saving..."

                : "Save Team Updates"}

            </button>

          </div>

        </section>



        <section className="leader-card">

          <SectionTitle

            eyebrow="AEP INCENTIVES"

            title="Team Incentive Tracker"

          />



          {incentives.length === 0 ? <EmptyState title="No active incentives" text="Admin has not published an incentive."/> : incentives.map(incentive => <div className="tracker-block" key={incentive.id}>
          <h4>{incentive.incentive_name}</h4>
          <div className="leader-table-wrap"><table className="leader-table"><thead><tr><th>Agent</th><th>Group</th><th>Submits</th><th>Estimated Tier</th><th>Next Tier</th></tr></thead><tbody>{agents.map(agent => {const status=getAgentIncentive(agent,incentive);return <tr key={agent.id}><td>{agent.first_name} {agent.last_name}</td><td>{status.group || 'Not assigned'}</td><td>{performanceValues[agent.id]?.submits || 0}</td><td>{status.ready ? `$${status.amount.toLocaleString()}` : status.reason}</td><td>{status.ready ? (status.next ? `${status.needed} more to ${status.next.tier_name}` : 'All tiers reached') : '—'}</td></tr>})}</tbody></table></div>
        </div>)}
      </section>



        <section className="leader-card">

          <SectionTitle

            eyebrow="ACTIVE RAFFLES"

            title="Team Raffle Tracker"

          />



          {raffles.length === 0 ? <EmptyState title="No active raffles" text="Admin has not published a raffle."/> : raffles.map(raffle => <div className="tracker-block raffle-block" key={raffle.id}>
          {raffle.image_url && <img src={raffle.image_url} alt={raffle.raffle_name} style={{maxWidth:320,width:'100%',maxHeight:220,objectFit:'contain'}}/>}
          <h4>{raffle.prize_name}</h4><p>{raffle.raffle_name}</p>
          <div className="raffle-agent-grid">{agents.map(agent => {const status=getRaffleStatus(agent,raffle);if(!status.eligible)return null;return <article className="raffle-agent-card" key={agent.id}><strong>{agent.first_name} {agent.last_name}</strong><p>{status.qualified?'PROVISIONALLY QUALIFIED':`${status.metCount} of ${status.details.length} requirements`}</p>{status.details.map(r=><div key={r.id}><span>{metricLabel(r.metric_type)}: </span><strong>{r.actual===null?'—':r.actual} / {r.required_value}</strong> {r.met?'✓':''}</div>)}</article>})}</div>
          <p className="raffle-disclaimer">Unofficial progress only. Final qualification is subject to official reporting.</p>
        </div>)}
      </section>



        <section className="site-performance">

          <SectionTitle

            eyebrow="LION NATION"

            title="Site AEP Performance"

          />



          <div className="site-scoreboard">

            <div>

              <span>SITE TARGET</span>

              <strong>

                {siteTarget.toLocaleString()}

              </strong>

            </div>



            <div>

              <span>SUBMITS</span>

              <strong>

                {siteSubmits.toLocaleString()}

              </strong>

            </div>



            <div>

              <span>PROGRESS</span>

              <strong>{siteProgress}%</strong>

            </div>



            <div>

              <span>REMAINING</span>

              <strong>

                {siteRemaining.toLocaleString()}

              </strong>

            </div>

          </div>



          <div className="site-progress-track">

            <div

              style={{

                width: `${Math.min(

                  siteProgress,

                  100

                )}%`,

              }}

            />

          </div>



          <div className="team-site-grid">

            {siteTeams.map((row) => (

              <article key={row.team_id}>

                <span>{row.team_name}</span>



                <strong>

                  {Number(

                    row.progress_percent || 0

                  )}

                  %

                </strong>



                <p>

                  {Number(

                    row.total_submits

                  ).toLocaleString()}{" "}

                  of{" "}

                  {Number(

                    row.team_target

                  ).toLocaleString()}

                </p>



                <div className="team-site-progress">

                  <div

                    style={{

                      width: `${Math.min(

                        Number(

                          row.progress_percent || 0

                        ),

                        100

                      )}%`,

                    }}

                  />

                </div>

              </article>

            ))}

          </div>

        </section>



        <section className="leader-card suggestion-card">

          <SectionTitle

            eyebrow="YOUR VOICE"

            title="Leader Suggestion Box"

          />



          <p className="suggestion-description">

            Have an idea that could improve the AEP

            experience, process or Lion Nation? Send it here.

          </p>



          <form onSubmit={submitSuggestion}>

            <label>

              Subject



              <input

                type="text"

                maxLength="100"

                placeholder="Optional"

                value={suggestionSubject}

                onChange={(event) =>

                  setSuggestionSubject(

                    event.target.value

                  )

                }

              />

            </label>



            <label>

              Suggestion



              <textarea

                maxLength="1500"

                placeholder="Tell us what you're thinking..."

                value={suggestionText}

                onChange={(event) =>

                  setSuggestionText(

                    event.target.value

                  )

                }

              />

            </label>



            <label className="anonymous-option">

              <input

                type="checkbox"

                checked={suggestionAnonymous}

                onChange={(event) =>

                  setSuggestionAnonymous(

                    event.target.checked

                  )

                }

              />



              Submit anonymously

            </label>



            <p className="anonymous-note">

              If selected, your name will not be shown with

              this suggestion when leadership reviews it.

            </p>



            {suggestionError && (

              <div className="leader-error">

                {suggestionError}

              </div>

            )}



            {suggestionMessage && (

              <div className="leader-success">

                {suggestionMessage}

              </div>

            )}



            <button

              type="submit"

              className="primary-button"

              disabled={suggestionSaving}

            >

              {suggestionSaving

                ? "Submitting..."

                : "Submit Suggestion"}

            </button>

          </form>

        </section>



        <footer className="leader-disclaimer">

          <div>!</div>



          <section>

            <strong>

              UNOFFICIAL PERFORMANCE TRACKER

            </strong>



            <p>

              Performance information shown in the Lion

              Nation Portal is provided for motivational and

              tracking purposes only. Results displayed here

              are unofficial. Final submit counts, incentive

              eligibility, earnings, raffle qualification and

              payouts are subject to verification through

              official company reporting and Finance.

            </p>

          </section>

        </footer>

      </main>

    </div>

  );

}



function Metric({ label, value, detail }) {

  return (

    <article className="leader-metric">

      <span>{label}</span>



      <strong>

        {typeof value === "number"

          ? value.toLocaleString()

          : value}

      </strong>



      <p>{detail}</p>

    </article>

  );

}



function SectionTitle({ eyebrow, title, badge }) {

  return (

    <div className="section-title">

      <div>

        <span>{eyebrow}</span>

        <h3>{title}</h3>

      </div>



      {badge && <b>{badge}</b>}

    </div>

  );

}



function EmptyState({ title, text }) {

  return (

    <div className="empty-state">

      <strong>{title}</strong>

      <p>{text}</p>

    </div>

  );

}



function formatMetric(metric) {

  if (metric === "submits") return "Sales";

  if (metric === "csr_transfers") return "CSR Transfers";

  if (metric === "productivity") return "Productivity";

  if (metric === "enrollment_links") return "Enrollment Links";



  return metric;

}



function formatRequirementValue(metric, value) {

  if (metric === "productivity") {

    return `${Number(value)}%`;

  }



  return Number(value).toLocaleString();

}



function formatActualValue(metric, value) {

  if (

    value === null ||

    value === undefined ||

    value === ""

  ) {

    return "—";

  }



  if (metric === "productivity") {

    return `${Number(value)}%`;

  }



  return Number(value).toLocaleString();

}