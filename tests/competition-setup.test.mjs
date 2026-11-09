import test from "node:test";
import assert from "node:assert/strict";
import { transitionSeason, transitionEvent, validateScoringRules, validateRuleset, canAmendRuleset, nextRulesetVersion, normalizeSeasonStatus, validateCalendarRoundCount, buildSeasonConfigurationSnapshot } from "../lib/competition/policy.mjs";

test("season lifecycle only allows planned registration activation completion and archive", () => {
  assert.equal(transitionSeason("PLANNED", "REGISTRATION").ok, true);
  assert.equal(transitionSeason("REGISTRATION", "ACTIVE").ok, true);
  assert.equal(transitionSeason("ACTIVE", "COMPLETED").ok, true);
  assert.equal(transitionSeason("COMPLETED", "ARCHIVED").ok, true);
  assert.equal(transitionSeason("ACTIVE", "REGISTRATION").reason, "INVALID_SEASON_TRANSITION");
});
test("race event lifecycle enforces ordered transitions", () => {
  assert.equal(transitionEvent("SCHEDULED", "REGISTRATION_LOCKED").ok, true);
  assert.equal(transitionEvent("READY", "RUNNING").ok, true);
  assert.equal(transitionEvent("RUNNING", "COMPLETED").ok, true);
  assert.equal(transitionEvent("SCHEDULED", "COMPLETED").ok, false);
});
test("points are configurable and validated without F1 defaults", () => {
  assert.equal(validateScoringRules({ points_by_position: { "1": 17, "2": 11 }, pole_position_bonus: 2 }).ok, true);
  assert.equal(validateScoringRules({ points_by_position: { "1": -1 } }).ok, false);
  assert.equal(validateScoringRules({ points_by_position: { "1": 1.5 } }).ok, false);
});
test("rulesets require every configuration domain", () => {
  const rules = Object.fromEntries(["calendar_rules","scoring_rules","penalty_rules","race_rules","economy_rules","eligibility_rules"].map((key) => [key, {}]));
  rules.scoring_rules = { points_by_position: { "1": 10 } };
  assert.equal(validateRuleset(rules).ok, true);
  assert.equal(validateRuleset({ ...rules, race_rules: null }).ok, false);
});
test("locked rulesets are immutable and amendments require a new version", () => {
  assert.equal(canAmendRuleset("LOCKED"), true);
  assert.equal(nextRulesetVersion([{ version: 1 }, { version: 3 }]), 4);
  assert.equal(canAmendRuleset("DRAFT"), false);
});
test("legacy schema season aliases normalize to roadmap lifecycle", () => {
  assert.equal(normalizeSeasonStatus("DRAFT"), "PLANNED");
  assert.equal(normalizeSeasonStatus("CONFIGURING"), "PLANNED");
  assert.equal(normalizeSeasonStatus("REGISTRATION"), "REGISTRATION");
});
test("calendar rounds are bounded positive integers", () => {
  assert.equal(validateCalendarRoundCount(25), true);
  assert.equal(validateCalendarRoundCount(0), false);
  assert.equal(validateCalendarRoundCount(1.5), false);
  assert.equal(validateCalendarRoundCount(101), false);
});

test("season activation snapshot captures all competition configuration domains", () => {
  const snapshot = buildSeasonConfigurationSnapshot({ divisions: [{ _id: "d1" }], calendars: [{ _id: "c1" }], rulesets: [{ version: 1 }], teams: [], drivers: [], events: [{ round_number: 1 }], entries: [] }, new Date("2026-01-01T00:00:00Z"));
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.divisions[0]._id, "d1");
  assert.equal(snapshot.events[0].round_number, 1);
  assert.equal(snapshot.captured_at.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.throws(() => buildSeasonConfigurationSnapshot({ divisions: [] }), /calendars must be an array/);
});
