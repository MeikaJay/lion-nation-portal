import { raffleStatus } from "./aepTracking";

const PERIOD_KEYS = {
  submits: "raffle_submits",
  csr_transfers: "raffle_csr_transfers",
  enrollment_links: "raffle_enrollment_links",
  talk_time: "raffle_talk_time",
};

// Cumulative AEP values must never be substituted for contest-period results.
export function periodRaffleStatus(agent, raffle, requirements, periodResult) {
  const original = raffleStatus(agent, raffle, requirements);
  if (!original.eligible) return original;
  const dataReady = periodResult?.status === "calculated";
  const details = original.details.map(req => {
    const key = PERIOD_KEYS[req.metric_type];
    const actual = dataReady && key && periodResult[key] != null
      ? Number(periodResult[key]) : null;
    return {
      ...req,
      actual,
      met: actual !== null && actual >= Number(req.required_value),
      pending: actual === null,
    };
  });
  const pending = details.some(req => req.pending);
  const periodMessage = !raffle.start_date || !raffle.end_date
    ? "Contest dates must be configured."
    : periodResult?.status === "partial_unknown"
      ? "Some earlier changes cannot be reconstructed. Period totals require verification."
      : periodResult?.status === "no_period_updates"
        ? "Waiting for a saved update during the contest reporting dates."
        : periodResult?.status === "calculated"
          ? "Sales and other countable totals reflect changes saved during the reporting window. Percentage requirements require verification."
          : "Contest-period information is pending verification.";
  return {
    ...original,
    details,
    metCount: details.filter(req => req.met).length,
    pending,
    qualified: details.length > 0 && details.every(req => req.met),
    periodMessage,
  };
}

export async function loadRafflePeriods(supabase, agentIds, raffles) {
  const pairs = agentIds.flatMap(agentId => raffles.map(raffle => ({agentId, raffle})));
  const entries = await Promise.all(pairs.map(async ({agentId, raffle}) => {
    const key = `${agentId}:${raffle.id}`;
    if (!raffle.start_date || !raffle.end_date) return [key, {status:"missing_dates"}];
    try {
      const {data, error} = await supabase.rpc("get_raffle_period_sales", {
        p_agent_id: agentId,
        p_start_date: raffle.start_date,
        p_end_date: raffle.end_date,
      });
      if (error) {
        console.error("Raffle reporting lookup:", error);
        return [key, {status:"unavailable"}];
      }
      return [key, data ?? {status:"unavailable"}];
    } catch(error) {
      console.error("Raffle reporting lookup:", error);
      return [key, {status:"unavailable"}];
    }
  }));
  return Object.fromEntries(entries);
}
