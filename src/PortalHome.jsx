

import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "./supabase";

import {

  incentiveStatus,

  raffleStatus,

  metricLabel,

} from "./aepTracking";

import "./PortalHome.css";



const DISCLAIMER =

  "Performance information shown in the Lion Nation Portal is provided for motivational and tracking purposes only. Results displayed here are unofficial. Final submit counts, incentive eligibility, earnings, raffle qualification and payouts are subject to verification through official company reporting and Finance.";



const money = (value) =>

  Number(value || 0).toLocaleString("en-US", {

    style: "currency",

    currency: "USD",

    maximumFractionDigits: 2,

  });



const number = (value) =>

  Number(value || 0).toLocaleString("en-US");



function displayMetric(metric, value) {

  if (value === null || value === undefined || value === "") {

    return "—";

  }



  const formatted = number(value);



  if (metric === "productivity" || metric === "conversion") {

    return `${formatted}%`;

  }



  return formatted;

}



export default function PortalHome() {

  const navigate = useNavigate();



  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [person, setPerson] = useState(null);

  const [teamName, setTeamName] = useState("Lion Nation");

  const [leaderboard, setLeaderboard] = useState([]);



  const [incentives, setIncentives] = useState([]);

  const [incentiveTiers, setIncentiveTiers] = useState([]);

  const [groups, setGroups] = useState([]);

  const [memberships, setMemberships] = useState([]);

  const [groupsLoaded, setGroupsLoaded] = useState(false);



  const [raffles, setRaffles] = useState([]);

  const [raffleRequirements, setRaffleRequirements] = useState([]);

  const [raffleImages, setRaffleImages] = useState({});



  const [showSuggestionForm, setShowSuggestionForm] = useState(false);

  const [suggestionSubject, setSuggestionSubject] = useState("");

  const [suggestionText, setSuggestionText] = useState("");

  const [isAnonymous, setIsAnonymous] = useState(false);

  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);

  const [suggestionSuccess, setSuggestionSuccess] = useState("");

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



      const { data: profile, error: profileError } = await supabase

        .from("aep_people")

        .select(`

          id,

          first_name,

          last_name,

          username,

          role,

          aep_target,

          team_id,

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

        .eq("auth_user_id", user.id)

        .eq("is_active", true)

        .maybeSingle();



      if (profileError) throw profileError;



      if (!profile) {

        await supabase.auth.signOut();

        navigate("/");

        return;

      }



      if (profile.role !== "agent") {

        if (profile.role === "leader") {

          navigate("/leader");

          return;

        }



        if (profile.role === "admin") {

          navigate("/admin");

          return;

        }



        await supabase.auth.signOut();

        navigate("/");

        return;

      }



      setPerson(profile);



      const [

        teamResult,

        leaderboardResult,

        incentiveResult,

        tierResult,

        groupResult,

        membershipResult,

        raffleResult,

        requirementResult,

      ] = await Promise.all([

        profile.team_id

          ? supabase

              .from("aep_teams")

              .select("team_name")

              .eq("id", profile.team_id)

              .maybeSingle()

          : Promise.resolve({ data: null, error: null }),



        supabase.rpc("get_aep_agent_leaderboard"),



        supabase

          .from("aep_incentives")

          .select("*")

          .eq("is_active", true)

          .order("created_at"),



        supabase

          .from("aep_incentive_tiers")

          .select("*")

          .order("display_order"),



        supabase

          .from("aep_incentive_groups")

          .select("*"),



        supabase

          .from("aep_incentive_group_members")

          .select("*")

          .eq("agent_id", profile.id),



        supabase

          .from("aep_raffles")

          .select("*")

          .eq("is_active", true)

          .order("created_at"),



        supabase

          .from("aep_raffle_requirements")

          .select("*"),

      ]);



      setTeamName(teamResult.data?.team_name || "Lion Nation");



      if (leaderboardResult.error) {

        console.error("Leaderboard error:", leaderboardResult.error);

      }

      setLeaderboard(leaderboardResult.data || []);



      if (incentiveResult.error) {

        console.error("Incentive error:", incentiveResult.error);

      }

      setIncentives(incentiveResult.data || []);



      if (tierResult.error) {

        console.error("Tier error:", tierResult.error);

      }

      setIncentiveTiers(tierResult.data || []);



      if (groupResult.error || membershipResult.error) {

        console.error(

          "Incentive group error:",

          groupResult.error || membershipResult.error

        );

      }



      setGroups(groupResult.data || []);

      setMemberships(membershipResult.data || []);

      setGroupsLoaded(

        !groupResult.error && !membershipResult.error

      );



      if (raffleResult.error) {

        console.error("Raffle error:", raffleResult.error);

      }

      setRaffles(raffleResult.data || []);



      if (requirementResult.error) {

        console.error("Requirements error:", requirementResult.error);

      }

      setRaffleRequirements(requirementResult.data || []);



      const imageEntries = await Promise.all(

        (raffleResult.data || [])

          .filter((raffle) => raffle.image_path)

          .map(async (raffle) => {

            const { data, error } = await supabase.storage

              .from("aep-raffle-images")

              .createSignedUrl(raffle.image_path, 3600);



            if (error) {

              console.error("Raffle image error:", error);

            }



            return [raffle.id, data?.signedUrl || null];

          })

      );



      setRaffleImages(Object.fromEntries(imageEntries));

    } catch (error) {

      console.error("Dashboard load error:", error);

      setErrorMessage(

        "We couldn't load your AEP dashboard right now."

      );

    } finally {

      setLoading(false);

    }

  }



  const target = Number(person?.aep_target || 0);

  const submits = Number(person?.current_submits || 0);

  const remaining = Math.max(target - submits, 0);

  const progressPercent =

    target > 0 ? Math.round((submits / target) * 100) : 0;



  const progressBarPercent = Math.max(

    0,

    Math.min(progressPercent, 100)

  );



  const activeIncentiveData = useMemo(

    () =>

      incentives

        .filter(

          (incentive) =>

            !incentive.incentive_category ||

            incentive.incentive_category ===

              person?.incentive_category

        )

        .map((incentive) => ({

          ...incentive,

          status: incentiveStatus(

            person || {},

            incentive,

            incentiveTiers,

            groups,

            memberships,

            groupsLoaded

          ),

        })),

    [

      incentives,

      incentiveTiers,

      groups,

      memberships,

      groupsLoaded,

      person,

    ]

  );



  const raffleData = useMemo(

    () =>

      raffles

        .map((raffle) => ({

          ...raffle,

          status: raffleStatus(

            person || {},

            raffle,

            raffleRequirements

          ),

        }))

        .filter((raffle) => raffle.status.eligible),

    [raffles, raffleRequirements, person]

  );



  const topAgents = leaderboard.slice(0, 5);



  const myRank =

    leaderboard.findIndex(

      (agent) => agent.agent_id === person?.id

    ) + 1;



  function openSuggestionBox() {

    setSuggestionSuccess("");

    setSuggestionError("");

    setShowSuggestionForm(true);

  }



  function closeSuggestionBox() {

    setShowSuggestionForm(false);

    setSuggestionSubject("");

    setSuggestionText("");

    setIsAnonymous(false);

    setSuggestionSuccess("");

    setSuggestionError("");

  }



  async function handleSuggestionSubmit(event) {

    event.preventDefault();



    const subject = suggestionSubject.trim();

    const suggestion = suggestionText.trim();



    setSuggestionError("");

    setSuggestionSuccess("");



    if (!suggestion) {

      setSuggestionError("Please enter your suggestion.");

      return;

    }



    if (!person?.id) {

      setSuggestionError(

        "We couldn't verify your Lion Nation profile."

      );

      return;

    }



    setSuggestionSubmitting(true);



    try {

      const { error } = await supabase

        .from("aep_suggestions")

        .insert({

          submitted_by: person.id,

          subject: subject || null,

          suggestion_text: suggestion,

          is_anonymous: isAnonymous,

          status: "new",

        });



      if (error) throw error;



      setSuggestionSubject("");

      setSuggestionText("");

      setIsAnonymous(false);

      setSuggestionSuccess(

        "Thank you! Your suggestion has been submitted."

      );

    } catch (error) {

      console.error("Suggestion error:", error);

      setSuggestionError(

        "We couldn't submit your suggestion. Please try again."

      );

    } finally {

      setSuggestionSubmitting(false);

    }

  }



  async function handleLogout() {

    await supabase.auth.signOut();

    navigate("/");

  }



  if (loading) {

    return (

      <div className="portal-loading">

        <img src="/Lion Nation.png" alt="Lion Nation" />

        <p>Loading your AEP dashboard...</p>

      </div>

    );

  }



  if (errorMessage) {

    return (

      <div className="portal-loading">

        <img src="/Lion Nation.png" alt="Lion Nation" />

        <p>{errorMessage}</p>

        <button type="button" onClick={loadDashboard}>

          Try Again

        </button>

      </div>

    );

  }



  return (

    <div className="agent-portal">

      <header className="portal-header">

        <div className="portal-brand">

          <img

            src="/Lion Nation.png"

            alt="Lion Nation"

            className="portal-logo"

          />

          <div>

            <p className="portal-eyebrow">LION NATION</p>

            <h1>AEP Performance Portal</h1>

          </div>

        </div>



        <button

          className="portal-logout"

          type="button"

          onClick={handleLogout}

        >

          Sign Out

        </button>

      </header>



      <main className="portal-main">

        <section className="portal-welcome">

          <div>

            <p className="welcome-label">

              YOUR AEP COMMAND CENTER

            </p>

            <h2>Welcome, {person?.first_name}.</h2>

            <p className="welcome-team">{teamName}</p>

          </div>



          <div className="welcome-message">

            <span>BE BOLD.</span>

            <span>STAY CONFIDENT.</span>

            <strong>BE A LION.</strong>

          </div>

        </section>



        <section className="performance-grid">

          <article className="performance-card">

            <p>AEP TARGET</p>

            <strong>{number(target)}</strong>

            <span>Your individual AEP goal</span>

          </article>



          <article className="performance-card">

            <p>ACTUAL SUBMITS</p>

            <strong>{number(submits)}</strong>

            <span>Current cumulative submits</span>

          </article>



          <article className="performance-card">

            <p>PROGRESS</p>

            <strong>{progressPercent}%</strong>

            <span>Of your AEP target</span>

          </article>



          <article className="performance-card">

            <p>REMAINING</p>

            <strong>{number(remaining)}</strong>

            <span>Submits to reach target</span>

          </article>

        </section>



        <section className="portal-card progress-section">

          <div className="section-heading">

            <div>

              <p className="section-eyebrow">

                YOUR AEP JOURNEY

              </p>

              <h3>Road to {number(target)}</h3>

            </div>



            <div className="progress-number">

              {progressPercent}%

            </div>

          </div>



          <div className="main-progress-track">

            <div

              className="main-progress-fill"

              style={{ width: `${progressBarPercent}%` }}

            />

          </div>



          <div className="progress-details">

            <span>

              <strong>{number(submits)}</strong> submits

            </span>

            <span>

              <strong>{number(remaining)}</strong> to go

            </span>

            <span>

              Goal: <strong>{number(target)}</strong>

            </span>

          </div>

        </section>



        <section className="portal-two-column rewards-grid">
        <article className="portal-card incentive-card">
          <div className="section-heading">
            <div><p className="section-eyebrow">AEP INCENTIVES</p><h3>Your Incentive Journey</h3></div>
            <span className="reward-heading-icon">★</span>
          </div>
          {activeIncentiveData.length === 0 ? (
            <div className="coming-soon-box"><p>Your incentive details will appear when Admin publishes them.</p></div>
          ) : activeIncentiveData.map((incentive) => {
            const status = incentive.status;
            const achieved = status.ready ? status.tiers.filter(t => submits >= Number(t.required_submits)) : [];
            const next = status.ready ? status.next : null;
            const priorThreshold = achieved.length ? Number(achieved[achieved.length - 1].required_submits) : 0;
            const nextThreshold = Number(next?.required_submits || 0);
            const milestonePercent = next && nextThreshold > priorThreshold
              ? Math.max(0, Math.min(100, ((submits - priorThreshold) / (nextThreshold - priorThreshold)) * 100))
              : 100;
            return (
              <div className="reward-incentive" key={incentive.id}>
                <div className="reward-incentive-intro">
                  <span className="reward-kicker">YOUR INCENTIVE</span>
                  <h4>{incentive.incentive_name}</h4>
                  {incentive.description && <p>{incentive.description}</p>}
                  {status.ready && <span className="reward-group-pill">{status.group}</span>}
                </div>
                {!status.ready ? (
                  <div className="coming-soon-box"><p>{status.reason} Contact your leader if your group needs updating.</p></div>
                ) : (
                  <>
                    <div className="reward-money-grid">
                      <div className="reward-money-tile"><span>ESTIMATED TIER AMOUNT</span><strong>{money(status.amount)}</strong><small>{status.earned ? `${status.earned.tier_name} achieved` : "No tier achieved yet"}</small></div>
                      <div className="reward-money-tile reward-money-next"><span>{next ? "NEXT TIER AMOUNT" : "MILESTONES"}</span><strong>{next ? money(next.earned_amount) : "Complete"}</strong><small>{next ? next.tier_name : "All configured tiers reached"}</small></div>
                    </div>
                    <div className="reward-milestone">
                      <div className="reward-milestone-title"><div><span className="reward-kicker">{next ? "UP NEXT" : "JOURNEY COMPLETE"}</span><h5>{next ? next.tier_name : "Every tier reached!"}</h5></div><strong>{next ? `${number(submits)} / ${number(nextThreshold)}` : `${number(submits)} submits`}</strong></div>
                      <div className="reward-progress-track" role="progressbar" aria-valuemin={priorThreshold} aria-valuemax={next ? nextThreshold : Math.max(submits, 1)} aria-valuenow={Math.min(submits, next ? nextThreshold : Math.max(submits, 1))}><div style={{width: `${milestonePercent}%`}} /></div>
                      <p>{next ? `${number(status.needed)} more submits to unlock ${next.tier_name}.` : "You've reached every configured incentive milestone."}</p>
                    </div>
                    <div className="reward-tier-heading"><h5>YOUR MILESTONES</h5><span>{achieved.length} of {status.tiers.length} reached</span></div>
                    <div className="reward-tier-list">
                      {status.tiers.map(tier => {
                        const reached = submits >= Number(tier.required_submits);
                        const isNext = next?.id === tier.id;
                        return <div className={`reward-tier-row ${reached ? "is-reached" : ""} ${isNext ? "is-next" : ""}`} key={tier.id}>
                          <span className="reward-tier-symbol">{reached ? "✓" : isNext ? "→" : "○"}</span>
                          <div className="reward-tier-info"><strong>{tier.tier_name}</strong><span>{number(tier.required_submits)} submits · {reached ? "Achieved" : isNext ? "Next milestone" : "Upcoming"}</span></div>
                          <strong className="reward-tier-amount">{money(tier.earned_amount)}</strong>
                        </div>;
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <p className="card-disclaimer">Incentive progress and estimated amounts are unofficial. Final eligibility and payouts are determined through official company reporting and Finance.</p>
        </article>

        <article className="portal-card raffle-card">
          <div className="section-heading"><div><p className="section-eyebrow">ACTIVE RAFFLES</p><h3>Your Raffle Progress</h3></div><span className="raffle-heading-icon">✦</span></div>
          {raffleData.length === 0 ? (
            <div className="raffle-empty"><div className="raffle-icon">★</div><h4>No Active Raffle Yet</h4><p>Your eligible raffles will appear here.</p></div>
          ) : <div className="reward-raffle-list">{raffleData.map(raffle => {
            const status = raffle.status;
            const total = status.details.length;
            const met = status.metCount || 0;
            return <div className="reward-raffle" key={raffle.id}>
              <div className="reward-raffle-top"><div><span className="reward-kicker">FEATURED RAFFLE</span><h4>{raffle.raffle_name}</h4></div><span className="reward-raffle-badge">{status.qualified ? "ALL MET*" : "IN PROGRESS"}</span></div>
              <div className="reward-prize-panel">
                {raffleImages[raffle.id] && <div className="reward-prize-image"><img src={raffleImages[raffle.id]} alt={raffle.prize_name || "Raffle prize"} /></div>}
                <div className="reward-prize-info"><span>THE PRIZE</span><h5>{raffle.prize_name || "Raffle prize"}</h5>{raffle.description && <p>{raffle.description}</p>}</div>
              </div>
              <div className="reward-raffle-progress">
                <div className="reward-raffle-progress-title"><div><span className="reward-kicker">YOUR QUALIFICATION</span><h5>{total ? `${met} of ${total} requirements met` : "Requirements pending"}</h5></div><strong>{total ? `${Math.round((met / total) * 100)}%` : "—"}</strong></div>
                <div className="reward-progress-track reward-progress-light"><div style={{width: `${total ? (met / total) * 100 : 0}%`}} /></div>
              </div>
              {total ? <div className="reward-qualifier-list">{status.details.map(req => {
                const actual = req.actual;
                const goal = Number(req.required_value);
                const pct = actual === null || actual === undefined || !Number.isFinite(Number(actual)) || goal <= 0 ? 0 : Math.max(0, Math.min(100, (Number(actual) / goal) * 100));
                return <div className={`reward-qualifier ${req.met ? "is-met" : ""}`} key={req.id}>
                  <div className="reward-qualifier-top"><span className="reward-check">{req.met ? "✓" : "○"}</span><strong>{metricLabel(req.metric_type)}</strong><span className="reward-qualifier-values">{displayMetric(req.metric_type, actual)} <em>/</em> {displayMetric(req.metric_type, req.required_value)}</span></div>
                  <div className="reward-qualifier-track"><div style={{width: `${pct}%`}} /></div>
                </div>;
              })}</div> : <p className="reward-no-qualifiers">Qualification requirements haven't been configured yet.</p>}
            </div>;
          })}</div>}
          <p className="card-disclaimer">*Unofficial progress only. Raffle qualification and ticket eligibility require verification through official company reporting. Please consult your leader for the latest status.</p>
        </article>
      </section>

      <section className="portal-two-column">

          <article className="portal-card leaderboard-card">

            <div className="section-heading">

              <div>

                <p className="section-eyebrow">

                  LION NATION

                </p>

                <h3>AEP Leaderboard</h3>

              </div>



              {myRank > 0 && (

                <span className="my-rank-badge">

                  YOUR RANK #{myRank}

                </span>

              )}

            </div>



            <div className="leaderboard-list">

              {topAgents.length === 0 ? (

                <div className="leaderboard-empty">

                  Leaderboard data will appear here.

                </div>

              ) : (

                topAgents.map((agent, index) => {

                  const isMe =

                    agent.agent_id === person?.id;



                  return (

                    <div

                      key={agent.agent_id}

                      className={`leaderboard-row ${

                        isMe ? "leaderboard-me" : ""

                      }`}

                    >

                      <div className="leaderboard-position">

                        {index + 1}

                      </div>



                      <div className="leaderboard-person">

                        <strong>

                          {agent.agent_name}

                          {isMe && (

                            <span className="you-label">

                              YOU

                            </span>

                          )}

                        </strong>

                        <span>

                          {agent.team_name ||

                            "Lion Nation"}

                        </span>

                      </div>



                      <div className="leaderboard-stats">

                        <strong>

                          {number(

                            agent.total_submits

                          )}

                        </strong>

                        <span>

                          {Number(

                            agent.progress_percent || 0

                          ).toFixed(1)}

                          %

                        </span>

                      </div>

                    </div>

                  );

                })

              )}

            </div>



            {myRank > 5 && (

              <div className="leaderboard-personal-rank">

                <span>Your current position</span>

                <strong>#{myRank}</strong>

              </div>

            )}



            <p className="card-disclaimer">

              Rankings use percentage toward individual

              AEP goals and unofficial performance data.

            </p>

          </article>



          <article className="portal-card suggestion-card">

            <div className="section-heading">

              <div>

                <p className="section-eyebrow">

                  YOUR VOICE MATTERS

                </p>

                <h3>Suggestion Box</h3>

              </div>

            </div>



            {!showSuggestionForm ? (

              <div className="feature-placeholder">

                <strong>

                  Help make Lion Nation better.

                </strong>

                <p>

                  Have an idea, suggestion or feedback?

                  Share it with Lion Nation leadership.

                </p>



                <button

                  type="button"

                  className="gold-outline-button"

                  onClick={openSuggestionBox}

                >

                  Share a Suggestion

                </button>

              </div>

            ) : (

              <form

                className="suggestion-form"

                onSubmit={handleSuggestionSubmit}

              >

                <div className="suggestion-field">

                  <label htmlFor="suggestion-subject">

                    Subject <span>Optional</span>

                  </label>

                  <input

                    id="suggestion-subject"

                    type="text"

                    maxLength={100}

                    placeholder="What's your suggestion about?"

                    value={suggestionSubject}

                    onChange={(event) =>

                      setSuggestionSubject(

                        event.target.value

                      )

                    }

                  />

                </div>



                <div className="suggestion-field">

                  <label htmlFor="suggestion-text">

                    Your Suggestion

                  </label>

                  <textarea

                    id="suggestion-text"

                    maxLength={1500}

                    placeholder="Tell us what you're thinking..."

                    value={suggestionText}

                    onChange={(event) =>

                      setSuggestionText(

                        event.target.value

                      )

                    }

                  />

                  <div className="suggestion-character-count">

                    {suggestionText.length} / 1500

                  </div>

                </div>



                <label className="anonymous-option">

                  <input

                    type="checkbox"

                    checked={isAnonymous}

                    onChange={(event) =>

                      setIsAnonymous(

                        event.target.checked

                      )

                    }

                  />

                  <span>Submit anonymously</span>

                </label>



                {isAnonymous && (

                  <p className="anonymous-note">

                    Your name will not be displayed

                    with the suggestion when leadership

                    reviews it.

                  </p>

                )}



                {suggestionError && (

                  <div className="suggestion-error">

                    {suggestionError}

                  </div>

                )}



                {suggestionSuccess && (

                  <div className="suggestion-success">

                    {suggestionSuccess}

                  </div>

                )}



                <div className="suggestion-actions">

                  <button

                    type="button"

                    className="suggestion-cancel"

                    onClick={closeSuggestionBox}

                    disabled={suggestionSubmitting}

                  >

                    Cancel

                  </button>



                  <button

                    type="submit"

                    className="suggestion-submit"

                    disabled={suggestionSubmitting}

                  >

                    {suggestionSubmitting

                      ? "Submitting..."

                      : "Submit Suggestion"}

                  </button>

                </div>

              </form>

            )}

          </article>

        </section>



        <footer className="portal-disclaimer">

          <div className="disclaimer-icon">!</div>

          <div className="disclaimer-content">

            <strong>

              UNOFFICIAL PERFORMANCE TRACKER

            </strong>

            <p>{DISCLAIMER}</p>

          </div>

        </footer>

      </main>

    </div>

  );

}