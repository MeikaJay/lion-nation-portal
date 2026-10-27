import { raffleStatus } from "./aepTracking";

// Never treat cumulative AEP sales as contest-period sales.
export function periodRaffleStatus(agent, raffle, requirements, periodResult) {
  const original = raffleStatus(agent, raffle, requirements);
  if (!original.eligible) return original;
  const details = original.details.map((req) => {
    // No historical record of a contest metric? Do not show cumulative totals as eligible.
    // Numeric percentages and hours cannot be reconstructed from cumulative percentages.
    if (["submits", "csr_transfers", "productivity", "conversion", "talk_time", "enrollment_links"].includes(req.metric_type)) {
      const supported = req.metric_type === "submits" && periodResult?.status === "calculated";
      const actual = supported ? Number(periodResult.raffle_submits) : null;
      return {...req, actual, met: supported && actual >= Number(req.required_value), pending: !supported};
    }
    return {...req, actual: null, met: false, pending: true};
  });
  return {...original, details, metCount: details.filter(d => d.met).length,
    pending: details.some(d => d.pending),
    qualified: details.length > 0 && details.every(d => d.met),
    periodMessage: !raffle.start_date || !raffle.end_date
      ? "Raffle dates must be configured."
      : periodResult?.status === "pending_baseline"
        ? "Pending verification: starting sales baseline unavailable."
        : periodResult?.status === "no_period_updates"
          ? "Waiting for a saved update during this raffle."
          : periodResult?.status === "calculated"
            ? "Sales reflect saved updates during this raffle. Other metrics require verification."
            : "Raffle period data pending verification."};
}

export async function loadRafflePeriods(supabase, agentIds, raffles) {
  const pairs = agentIds.flatMap(agentId => raffles.map(raffle => ({agentId, raffle})));
  const entries = await Promise.all(pairs.map(async ({agentId, raffle}) => {
    if (!raffle.start_date || !raffle.end_date) return [`${agentId}:${raffle.id}`, {status: "missing_dates"}];
    try {
      const {data, error} = await supabase.rpc("get_raffle_period_sales", {
        p_agent_id: agentId,
        p_start_date: raffle.start_date,
        p_end_date: raffle.end_date,
      });
      if (error) {
        console.error("Raffle period lookup:", error);
        return [`${agentId}:${raffle.id}`, {status: "unavailable"}];
      }
      return [`${agentId}:${raffle.id}`, data ?? {status: "unavailable"}];
    } catch (error) {
      console.error("Raffle period lookup:", error);
      return [`${agentId}:${raffle.id}`, {status: "unavailable"}];
    }
  }));
  return Object.fromEntries(entries);
}
