import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import "./PortalHome.css";

export default function PortalHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [incentives, setIncentives] = useState([]);
  const [incentiveTiers, setIncentiveTiers] = useState([]);
  const [raffles, setRaffles] = useState([]);
  const [raffleRequirements, setRaffleRequirements] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [showSuggestionForm, setShowSuggestionForm] =
    useState(false);
  const [suggestionSubject, setSuggestionSubject] =
    useState("");
  const [suggestionText, setSuggestionText] =
    useState("");
  const [isAnonymous, setIsAnonymous] =
    useState(false);
  const [suggestionSubmitting, setSuggestionSubmitting] =
    useState(false);
  const [suggestionSuccess, setSuggestionSuccess] =
    useState("");
  const [suggestionError, setSuggestionError] =
    useState("");

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

      const { data: profile, error: profileError } =
        await supabase
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
            current_submits,
            current_csr_transfers,
            current_productivity,
            current_enrollment_links
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
        raffleResult,
        requirementResult,
      ] = await Promise.all([
        profile.team_id
          ? supabase
              .from("aep_teams")
              .select("team_name")
              .eq("id", profile.team_id)
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),

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
          .from("aep_raffles")
          .select("*")
          .eq("is_active", true)
          .order("created_at"),

        supabase
          .from("aep_raffle_requirements")
          .select("*"),
      ]);

      if (teamResult.error) {
        console.error("Team error:", teamResult.error);
      }

      setTeamName(
        teamResult.data?.team_name || "Lion Nation"
      );

      if (leaderboardResult.error) {
        console.error(
          "Leaderboard error:",
          leaderboardResult.error
        );
        setLeaderboard([]);
      } else {
        setLeaderboard(
          leaderboardResult.data || []
        );
      }

      if (incentiveResult.error) {
        console.error(
          "Incentive error:",
          incentiveResult.error
        );
      }

      if (tierResult.error) {
        console.error(
          "Incentive tier error:",
          tierResult.error
        );
      }

      if (raffleResult.error) {
        console.error(
          "Raffle error:",
          raffleResult.error
        );
      }

      if (requirementResult.error) {
        console.error(
          "Raffle requirement error:",
          requirementResult.error
        );
      }

      setIncentives(incentiveResult.data || []);
      setIncentiveTiers(tierResult.data || []);
      setRaffles(raffleResult.data || []);
      setRaffleRequirements(
        requirementResult.data || []
      );
    } catch (error) {
      console.error(
        "Dashboard load error:",
        error
      );

      setErrorMessage(
        "We couldn't load your AEP dashboard right now."
      );
    } finally {
      setLoading(false);
    }
  }

  const target = Number(
    person?.aep_target || 0
  );

  const submits = Number(
    person?.current_submits || 0
  );

  const csrTransfers = Number(
    person?.current_csr_transfers || 0
  );

  const productivity =
    person?.current_productivity === null ||
    person?.current_productivity === undefined
      ? null
      : Number(person.current_productivity);

  const enrollmentLinks = Number(
    person?.current_enrollment_links || 0
  );

  const remaining = Math.max(
    target - submits,
    0
  );

  const progressPercent =
    target > 0
      ? Math.round(
          (submits / target) * 100
        )
      : 0;

  const progressBarPercent = Math.min(
    progressPercent,
    100
  );

  const activeIncentiveData = useMemo(() => {
    return incentives.map((incentive) => {
      const tiers = incentiveTiers
        .filter(
          (tier) =>
            tier.incentive_id === incentive.id
        )
        .sort(
          (a, b) =>
            Number(a.required_submits) -
            Number(b.required_submits)
        );

      const earnedTier = [...tiers]
        .reverse()
        .find(
          (tier) =>
            submits >=
            Number(tier.required_submits)
        );

      const nextTier = tiers.find(
        (tier) =>
          submits <
          Number(tier.required_submits)
      );

      return {
        ...incentive,
        tiers,
        earnedTier,
        nextTier,
        earnedAmount: earnedTier
          ? Number(
              earnedTier.earned_amount || 0
            )
          : 0,
        submitsToNextTier: nextTier
          ? Math.max(
              Number(
                nextTier.required_submits
              ) - submits,
              0
            )
          : 0,
      };
    });
  }, [
    incentives,
    incentiveTiers,
    submits,
  ]);

  const raffleData = useMemo(() => {
    return raffles.map((raffle) => {
      const requirements =
        raffleRequirements
          .filter(
            (requirement) =>
              requirement.raffle_id ===
              raffle.id
          )
          .map((requirement) => {
            let actual = 0;

            if (
              requirement.metric_type ===
              "submits"
            ) {
              actual = submits;
            }

            if (
              requirement.metric_type ===
              "csr_transfers"
            ) {
              actual = csrTransfers;
            }

            if (
              requirement.metric_type ===
              "productivity"
            ) {
              actual = productivity;
            }

            if (
              requirement.metric_type ===
              "enrollment_links"
            ) {
              actual = enrollmentLinks;
            }

            const required = Number(
              requirement.required_value || 0
            );

            const met =
              actual !== null &&
              Number(actual) >= required;

            return {
              ...requirement,
              actual,
              required,
              met,
            };
          });

      const metCount =
        requirements.filter(
          (requirement) =>
            requirement.met
        ).length;

      return {
        ...raffle,
        requirements,
        metCount,
        qualified:
          requirements.length > 0 &&
          metCount === requirements.length,
      };
    });
  }, [
    raffles,
    raffleRequirements,
    submits,
    csrTransfers,
    productivity,
    enrollmentLinks,
  ]);

  const topAgents =
    leaderboard.slice(0, 5);

  const myRank =
    leaderboard.findIndex(
      (agent) =>
        agent.agent_id === person?.id
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
    setSuggestionError("");
    setSuggestionSuccess("");
  }

  async function handleSuggestionSubmit(e) {
    e.preventDefault();

    setSuggestionError("");
    setSuggestionSuccess("");

    const cleanSubject =
      suggestionSubject.trim();

    const cleanSuggestion =
      suggestionText.trim();

    if (!cleanSuggestion) {
      setSuggestionError(
        "Please enter your suggestion before submitting."
      );
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
          subject: cleanSubject || null,
          suggestion_text: cleanSuggestion,
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
      console.error(
        "Suggestion submission error:",
        error
      );

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
        <img
          src="/Lion Nation.png"
          alt="Lion Nation"
        />

        <p>
          Loading your AEP dashboard...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="portal-loading">
        <img
          src="/Lion Nation.png"
          alt="Lion Nation"
        />

        <p>{errorMessage}</p>

        <button
          type="button"
          onClick={loadDashboard}
        >
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
            <p className="portal-eyebrow">
              LION NATION
            </p>

            <h1>
              AEP Performance Portal
            </h1>
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

            <h2>
              Welcome,{" "}
              {person?.first_name}.
            </h2>

            <p className="welcome-team">
              {teamName}
            </p>
          </div>

          <div className="welcome-message">
            <span>BE BOLD.</span>
            <span>
              STAY CONFIDENT.
            </span>
            <strong>
              BE A LION.
            </strong>
          </div>
        </section>

        <section className="performance-grid">
          <article className="performance-card">
            <p>AEP TARGET</p>

            <strong>
              {target.toLocaleString()}
            </strong>

            <span>
              Your individual AEP goal
            </span>
          </article>

          <article className="performance-card">
            <p>ACTUAL SUBMITS</p>

            <strong>
              {submits.toLocaleString()}
            </strong>

            <span>
              Current cumulative submits
            </span>
          </article>

          <article className="performance-card">
            <p>PROGRESS</p>

            <strong>
              {progressPercent}%
            </strong>

            <span>
              Of your AEP target
            </span>
          </article>

          <article className="performance-card">
            <p>REMAINING</p>

            <strong>
              {remaining.toLocaleString()}
            </strong>

            <span>
              Submits to reach target
            </span>
          </article>
        </section>

        <section className="portal-card progress-section">
          <div className="section-heading">
            <div>
              <p className="section-eyebrow">
                YOUR AEP JOURNEY
              </p>

              <h3>
                Road to{" "}
                {target.toLocaleString()}
              </h3>
            </div>

            <div className="progress-number">
              {progressPercent}%
            </div>
          </div>

          <div className="main-progress-track">
            <div
              className="main-progress-fill"
              style={{
                width: `${progressBarPercent}%`,
              }}
            />
          </div>

          <div className="progress-details">
            <span>
              <strong>
                {submits.toLocaleString()}
              </strong>{" "}
              submits
            </span>

            <span>
              <strong>
                {remaining.toLocaleString()}
              </strong>{" "}
              to go
            </span>

            <span>
              Goal:{" "}
              <strong>
                {target.toLocaleString()}
              </strong>
            </span>
          </div>
        </section>

        <section className="portal-two-column">
          <article className="portal-card incentive-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">
                  AEP INCENTIVE
                </p>

                <h3>
                  Your Incentive Progress
                </h3>
              </div>
            </div>

            {activeIncentiveData.length === 0 ? (
              <>
                <div className="incentive-earned">
                  <span>
                    Current Earned Amount
                  </span>

                  <strong>$0</strong>
                </div>

                <div className="coming-soon-box">
                  <p>
                    Incentive tiers and your
                    progress will appear here
                    once the current incentive
                    is published.
                  </p>
                </div>
              </>
            ) : (
              activeIncentiveData.map(
                (incentive) => (
                  <div
                    className="agent-incentive-block"
                    key={incentive.id}
                  >
                    <div className="agent-incentive-name">
                      <strong>
                        {incentive.incentive_name}
                      </strong>

                      {incentive.description && (
                        <span>
                          {incentive.description}
                        </span>
                      )}
                    </div>

                    <div className="incentive-earned">
                      <span>
                        Current Earned Amount
                      </span>

                      <strong>
                        $
                        {incentive.earnedAmount.toLocaleString()}
                      </strong>
                    </div>

                    <div className="incentive-next">
                      {incentive.nextTier ? (
                        <>
                          <span>
                            NEXT TIER
                          </span>

                          <strong>
                            $
                            {Number(
                              incentive.nextTier
                                .earned_amount || 0
                            ).toLocaleString()}
                          </strong>

                          <p>
                            At{" "}
                            {
                              incentive.nextTier
                                .required_submits
                            }{" "}
                            submits
                          </p>

                          <b>
                            {
                              incentive.submitsToNextTier
                            }{" "}
                            more to go
                          </b>
                        </>
                      ) : (
                        <>
                          <span>
                            STATUS
                          </span>

                          <strong>
                            ALL TIERS REACHED
                          </strong>

                          <p>
                            Keep building.
                          </p>
                        </>
                      )}
                    </div>

                    {incentive.tiers.length > 0 && (
                      <div className="tier-road">
                        {incentive.tiers.map(
                          (tier) => {
                            const reached =
                              submits >=
                              Number(
                                tier.required_submits
                              );

                            return (
                              <div
                                className={
                                  reached
                                    ? "tier-step tier-reached"
                                    : "tier-step"
                                }
                                key={tier.id}
                              >
                                <b>
                                  {reached
                                    ? "✓"
                                    : tier.required_submits}
                                </b>

                                <span>
                                  {tier.tier_name}
                                </span>

                                <small>
                                  $
                                  {Number(
                                    tier.earned_amount ||
                                      0
                                  ).toLocaleString()}
                                </small>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                )
              )
            )}

            <p className="card-disclaimer">
              Incentive progress shown here is
              unofficial and subject to final
              verification through official
              company reporting and Finance.
            </p>
          </article>

          <article className="portal-card raffle-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">
                  ACTIVE RAFFLES
                </p>

                <h3>
                  Your Raffle Progress
                </h3>
              </div>
            </div>

            {raffleData.length === 0 ? (
              <div className="raffle-empty">
                <div className="raffle-icon">
                  ★
                </div>

                <h4>
                  No Active Raffle Yet
                </h4>

                <p>
                  Active prizes,
                  qualification requirements
                  and your progress will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="agent-raffle-list">
                {raffleData.map((raffle) => (
                  <div
                    className="agent-raffle"
                    key={raffle.id}
                  >
                    <div className="agent-raffle-header">
                      <div>
                        <span>PRIZE</span>

                        <h4>
                          {raffle.prize_name}
                        </h4>

                        <p>
                          {raffle.raffle_name}
                        </p>
                      </div>

                      <b
                        className={
                          raffle.qualified
                            ? "agent-qualified"
                            : "agent-in-progress"
                        }
                      >
                        {raffle.qualified
                          ? "QUALIFIED"
                          : `${raffle.metCount} OF ${raffle.requirements.length}`}
                      </b>
                    </div>

                    {raffle.description && (
                      <p className="raffle-description">
                        {raffle.description}
                      </p>
                    )}

                    <div className="agent-requirements">
                      {raffle.requirements.map(
                        (requirement) => (
                          <div
                            className={
                              requirement.met
                                ? "agent-requirement requirement-complete"
                                : "agent-requirement"
                            }
                            key={requirement.id}
                          >
                            <div>
                              <span>
                                {formatMetric(
                                  requirement.metric_type
                                )}
                              </span>

                              <strong>
                                {formatActual(
                                  requirement.metric_type,
                                  requirement.actual
                                )}
                                {" / "}
                                {formatRequired(
                                  requirement.metric_type,
                                  requirement.required
                                )}
                              </strong>
                            </div>

                            <b>
                              {requirement.met
                                ? "✓"
                                : "•"}
                            </b>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="card-disclaimer">
              Unofficial progress only. Please
              consult your leader for the most
              accurate and updated raffle
              qualification status.
            </p>
          </article>
        </section>

        <section className="portal-two-column">
          <article className="portal-card leaderboard-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">
                  LION NATION
                </p>

                <h3>
                  AEP Leaderboard
                </h3>
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
                  Leaderboard data will appear
                  here.
                </div>
              ) : (
                topAgents.map(
                  (agent, index) => {
                    const isMe =
                      agent.agent_id ===
                      person?.id;

                    return (
                      <div
                        className={`leaderboard-row ${
                          isMe
                            ? "leaderboard-me"
                            : ""
                        }`}
                        key={agent.agent_id}
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
                            {Number(
                              agent.total_submits ||
                                0
                            ).toLocaleString()}
                          </strong>

                          <span>
                            {Number(
                              agent.progress_percent ||
                                0
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>

            {myRank > 5 && (
              <div className="leaderboard-personal-rank">
                <span>
                  Your current position
                </span>

                <strong>
                  #{myRank}
                </strong>
              </div>
            )}

            <p className="card-disclaimer">
              Rankings are based on percentage
              toward individual AEP target using
              unofficial portal performance data.
            </p>
          </article>

          <article className="portal-card suggestion-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">
                  YOUR VOICE MATTERS
                </p>

                <h3>
                  Suggestion Box
                </h3>
              </div>
            </div>

            {!showSuggestionForm ? (
              <div className="feature-placeholder">
                <strong>
                  Help make Lion Nation better.
                </strong>

                <p>
                  Have an idea, suggestion or
                  feedback? Share it directly
                  with Lion Nation leadership.
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
                onSubmit={
                  handleSuggestionSubmit
                }
              >
                <div className="suggestion-field">
                  <label htmlFor="suggestion-subject">
                    Subject{" "}
                    <span>Optional</span>
                  </label>

                  <input
                    id="suggestion-subject"
                    type="text"
                    maxLength={100}
                    placeholder="What's your suggestion about?"
                    value={suggestionSubject}
                    onChange={(e) => {
                      setSuggestionSubject(
                        e.target.value
                      );
                      setSuggestionError("");
                    }}
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
                    onChange={(e) => {
                      setSuggestionText(
                        e.target.value
                      );
                      setSuggestionError("");
                    }}
                  />

                  <div className="suggestion-character-count">
                    {suggestionText.length} / 1500
                  </div>
                </div>

                <label className="anonymous-option">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) =>
                      setIsAnonymous(
                        e.target.checked
                      )
                    }
                  />

                  <span>
                    Submit anonymously
                  </span>
                </label>

                {isAnonymous && (
                  <p className="anonymous-note">
                    Your name will not be shown
                    with this suggestion when
                    leadership reviews it.
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
                    onClick={
                      closeSuggestionBox
                    }
                    disabled={
                      suggestionSubmitting
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="suggestion-submit"
                    disabled={
                      suggestionSubmitting
                    }
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
          <div className="disclaimer-icon">
            !
          </div>

          <div className="disclaimer-content">
            <strong>
              UNOFFICIAL PERFORMANCE TRACKER
            </strong>

            <p>
              Performance information shown in
              the Lion Nation Portal is provided
              for motivational and tracking
              purposes only. Results displayed
              here are unofficial. Final submit
              counts, incentive eligibility,
              earnings, raffle qualification and
              payouts are subject to verification
              through official company reporting
              and Finance.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function formatMetric(metric) {
  if (metric === "submits") {
    return "Sales / Submits";
  }

  if (metric === "csr_transfers") {
    return "CSR Transfers";
  }

  if (metric === "productivity") {
    return "Productivity";
  }

  if (metric === "enrollment_links") {
    return "Enrollment Links";
  }

  return metric;
}

function formatActual(metric, value) {
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

function formatRequired(metric, value) {
  if (metric === "productivity") {
    return `${Number(value)}%`;
  }

  return Number(value).toLocaleString();
}