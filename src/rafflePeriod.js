import { raffleStatus } from "./aepTracking";

const PERIOD_KEYS = {
  submits: ["raffle_submits", "unknown_submits"],
  csr_transfers: ["raffle_csr_transfers", "unknown_csr_transfers"],
  enrollment_links: ["raffle_enrollment_links", "unknown_enrollment_links"],
  talk_time: ["raffle_talk_time", "unknown_talk_time"],
};

export function periodRaffleStatus(agent, raffle, requirements, periodResult) {
  const original = raffleStatus(agent, raffle, requirements);
  if (!original.eligible) return original;
  const available = ["calculated", "partial_verified"].includes(periodResult?.status);
  const details = original.details.map(req => {
    const keys = PERIOD_KEYS[req.metric_type];
    const actual = available && keys && periodResult[keys[0]] != null
      ? Number(periodResult[keys[0]]) : null;
    const incomplete = !available || !keys || Number(periodResult?.[keys?.[1]] || 0) > 0;
    // An incomplete total is a confirmed minimum, not proof of final qualification.
    return {
      ...req,
      actual,
      met: actual !== null && actual >= Number(req.required_value),
      pending: incomplete,
      partial: incomplete && actual !== null,
    };
  });
  const pending = details.some(req => req.pending);
  const periodMessage = !raffle.start_date || !raffle.end_date
    ? "Contest dates must be configured."
    : periodResult?.status === "partial_verified"
      ? "Verified increases are shown. Earlier updates without a starting total may mean the actual contest total is higher. Final qualification requires verification."
      : periodResult?.status === "no_period_updates"
        ? "Waiting for an update during the contest reporting dates."
        : periodResult?.status === "calculated"
          ? "Countable totals reflect saved increases during the reporting window. Percentage requirements need separate verification."
          : "Contest-period information is pending verification.";
  return {
    ...original,
    details,
    metCount: details.filter(req => req.met).length,
    pending,
    qualified: details.length > 0 && details.every(req => req.met && !req.pending),
    periodMessage,
  };
}

export async function loadRafflePeriods(supabase, agentIds, raffles) {
  const pairs = agentIds.flatMap(agentId => raffles.map(raffle => ({ agentId, raffle })));
  const entries = await Promise.all(pairs.map(async ({ agentId, raffle }) => {
    const key = `${agentId}:${raffle.id}`;
    if (!raffle.start_date || !raffle.end_date) return [key, { status: "missing_dates" }];
    try {
      const { data, error } = await supabase.rpc("get_raffle_period_sales", {
        p_agent_id: agentId,
        p_start_date: raffle.start_date,
        p_end_date: raffle.end_date,
      });
      if (error) {
        console.error("Raffle reporting lookup:", error);
        return [key, { status: "unavailable" }];
      }
      return [key, data ?? { status: "unavailable" }];
    } catch (error) {
      console.error("Raffle reporting lookup:", error);
      return [key, { status: "unavailable" }];
    }
  }));
  return Object.fromEntries(entries);
}
