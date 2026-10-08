
export const metricLabel = (metric) => ({
    submits: "MM Submits",
    csr_transfers: "CSR Transfers",
    productivity: "Productivity",
    enrollment_links: "Enrollment Links",
    talk_time: "AWS Online Hours",
    conversion: "Conversion",
  }[metric] || metric);
  
  export const metricValue = (agent, metric) => {
    const key = {
      submits: "current_submits",
      csr_transfers: "current_csr_transfers",
      productivity: "current_productivity",
      enrollment_links: "current_enrollment_links",
      talk_time: "current_talk_time",
      conversion: "current_conversion",
    }[metric];
  
    if (!key || agent?.[key] == null || agent[key] === "") {
      return null;
    }
  
    const value = Number(agent[key]);
    return Number.isFinite(value) ? value : null;
  };
  
  export function incentiveStatus(
    agent,
    incentive,
    tiers = [],
    groups = [],
    memberships = [],
    groupDataAvailable = true
  ) {
    if (!groupDataAvailable) {
      return {
        ready: false,
        reason: "Incentive group information is unavailable.",
      };
    }
  
    const membership = memberships.find(
      (item) =>
        item.incentive_id === incentive.id &&
        item.agent_id === agent?.id
    );
  
    const group = groups.find(
      (item) =>
        item.id === membership?.group_id &&
        item.incentive_id === incentive.id
    );
  
    if (!group) {
      return {
        ready: false,
        reason: "No incentive group assigned.",
      };
    }
  
    const eligibleTiers = tiers
      .filter(
        (tier) =>
          tier.incentive_id === incentive.id &&
          tier.group_id === group.id
      )
      .sort(
        (a, b) =>
          Number(a.required_submits) -
          Number(b.required_submits)
      );
  
    if (!eligibleTiers.length) {
      return {
        ready: false,
        group: group.group_name,
        reason: "No incentive tiers configured for this group.",
      };
    }
  
    const submits = Number(agent?.current_submits || 0);
  
    const earned = [...eligibleTiers]
      .reverse()
      .find(
        (tier) =>
          submits >= Number(tier.required_submits)
      );
  
    const next = eligibleTiers.find(
      (tier) =>
        submits < Number(tier.required_submits)
    );
  
    return {
      ready: true,
      group: group.group_name,
      tiers: eligibleTiers,
      earned,
      next,
      amount: Number(earned?.earned_amount || 0),
      needed: next
        ? Number(next.required_submits) - submits
        : 0,
    };
  }
  
  export function raffleStatus(
    agent,
    raffle,
    requirements = []
  ) {
    const role = agent?.raffle_role;
  
    if (
      raffle.audience &&
      raffle.audience !== "everyone" &&
      raffle.audience !== role
    ) {
      return {
        eligible: false,
        details: [],
        metCount: 0,
        qualified: false,
      };
    }
  
    const details = requirements
      .filter(
        (requirement) =>
          requirement.raffle_id === raffle.id &&
          (
            !requirement.audience ||
            requirement.audience === "everyone" ||
            requirement.audience === role
          )
      )
      .map((requirement) => {
        const actual = metricValue(
          agent,
          requirement.metric_type
        );
  
        return {
          ...requirement,
          actual,
          met:
            actual !== null &&
            actual >= Number(requirement.required_value),
        };
      });
  
    return {
      eligible: true,
      details,
      metCount: details.filter((item) => item.met).length,
      qualified:
        details.length > 0 &&
        details.every((item) => item.met),
    };
  }
  