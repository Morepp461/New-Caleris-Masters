const SEASON_TRANSITIONS = {
  PLANNED: ["REGISTRATION", "CANCELLED"],
  REGISTRATION: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};
const EVENT_TRANSITIONS = {
  SCHEDULED: ["REGISTRATION_LOCKED", "CANCELLED"],
  REGISTRATION_LOCKED: ["READY", "CANCELLED"],
  READY: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED"],
  COMPLETED: ["REVIEWED"],
  REVIEWED: [],
  CANCELLED: [],
};
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
export function transitionSeason(current, next) {
  if (!SEASON_TRANSITIONS[current]?.includes(next)) return { ok: false, reason: "INVALID_SEASON_TRANSITION" };
  return { ok: true, status: next };
}
export function transitionEvent(current, next) {
  if (!EVENT_TRANSITIONS[current]?.includes(next)) return { ok: false, reason: "INVALID_EVENT_TRANSITION" };
  return { ok: true, status: next };
}
export function validateScoringRules(rules) {
  if (!object(rules)) return { ok: false, reason: "SCORING_RULES_REQUIRED" };
  const maps = [rules.points_by_position, ...(rules.sprint_enabled ? [rules.sprint_points] : [])];
  for (const map of maps) {
    if (!object(map) || Object.keys(map).length === 0) return { ok: false, reason: "POINTS_MAP_REQUIRED" };
    for (const [position, points] of Object.entries(map)) {
      if (!/^[1-9][0-9]*$/.test(position) || !Number.isSafeInteger(points) || points < 0) {
        return { ok: false, reason: "INVALID_POINTS_CONFIGURATION" };
      }
    }
  }
  for (const key of ["pole_position_bonus", "fastest_lap_bonus"]) {
    if (rules[key] !== undefined && (!Number.isSafeInteger(rules[key]) || rules[key] < 0)) {
      return { ok: false, reason: "INVALID_BONUS_CONFIGURATION" };
    }
  }
  return { ok: true };
}
export function validateRuleset(input) {
  if (!object(input)) return { ok: false, reason: "RULESET_REQUIRED" };
  for (const key of ["calendar_rules", "scoring_rules", "penalty_rules", "race_rules", "economy_rules", "eligibility_rules"]) {
    if (!object(input[key])) return { ok: false, reason: "INVALID_" + key.toUpperCase() };
  }
  return validateScoringRules(input.scoring_rules);
}
export function canAmendRuleset(status) {
  return status === "LOCKED" || status === "ACTIVE";
}
export function nextRulesetVersion(existing) {
  return existing.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
}
export function normalizeSeasonStatus(status) {
  const aliases = { DRAFT: "PLANNED", CONFIGURING: "PLANNED" };
  return aliases[status] ?? status;
}
export function validateCalendarRoundCount(totalRounds) {
  return Number.isSafeInteger(totalRounds) && totalRounds >= 1 && totalRounds <= 100;
}

export function buildSeasonConfigurationSnapshot(input, capturedAt = new Date()) {
  const keys = ["divisions", "calendars", "rulesets", "teams", "drivers", "events", "entries"];
  for (const key of keys) {
    if (!Array.isArray(input[key])) throw new TypeError("Snapshot " + key + " must be an array.");
  }
  return {
    version: 1,
    captured_at: capturedAt,
    divisions: input.divisions,
    calendars: input.calendars,
    rulesets: input.rulesets,
    teams: input.teams,
    drivers: input.drivers,
    events: input.events,
    entries: input.entries,
  };
}
