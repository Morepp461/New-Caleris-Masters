import { QUERY_PLAN_CASES } from "../scripts/db/query-plan-catalog.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { COLLECTION_VALIDATORS, DOMAIN_COLLECTIONS, FIELD_SCHEMA_CATALOG, INDEXES, LEGACY_INDEXES_TO_DROP, NATURAL_KEY_BASELINE_VALIDATOR, UUID_BASELINE_VALIDATOR } from "../scripts/db/collections.mjs";

test("domain collection catalog matches the supplied data dictionary", () => {
  assert.equal(DOMAIN_COLLECTIONS.length, 63);
  assert.equal(new Set(DOMAIN_COLLECTIONS).size, DOMAIN_COLLECTIONS.length);
  assert.ok(DOMAIN_COLLECTIONS.includes("players"));
  assert.ok(DOMAIN_COLLECTIONS.includes("ledger_entries"));
  assert.ok(DOMAIN_COLLECTIONS.includes("race_sessions"));
  assert.ok(DOMAIN_COLLECTIONS.includes("outbox_events"));
  assert.ok(!DOMAIN_COLLECTIONS.includes("role_history"));
});

test("all source-backed custom indexes are represented once", () => {
  assert.equal(INDEXES.length, 44);
  const names = INDEXES.map(([, name]) => name);
  assert.equal(new Set(names).size, names.length);
  for (const [collection] of INDEXES) {
    assert.ok(DOMAIN_COLLECTIONS.includes(collection), `Unknown collection: ${collection}`);
  }
});

test("all source-backed unique indexes declare uniqueness", () => {
  const uniqueIndexes = INDEXES.filter(([, , definition]) => definition.unique === true);
  assert.ok(uniqueIndexes.length >= 10);
  for (const [, name, definition] of uniqueIndexes) {
    assert.equal(definition.unique, true, name);
  }
});

test("active gameplay role has a partial unique index", () => {
  const index = INDEXES.find(([, name]) => name === "uq_role_assignments_active_player");
  assert.ok(index);
  assert.equal(index[2].unique, true);
  assert.deepEqual(index[2].partialFilterExpression, { status: "ACTIVE" });
});

test("race event has one active authoritative session", () => {
  const index = INDEXES.find(([, name]) => name === "uq_race_sessions_active_event");
  assert.ok(index);
  assert.equal(index[2].unique, true);
  assert.deepEqual(index[2].partialFilterExpression.status.$in, [
    "PENDING", "INITIALIZING", "RUNNING", "PAUSED", "RECOVERING",
  ]);
});

test("UUID baseline validator enforces UUID v4 string identifiers", () => {
  assert.deepEqual(UUID_BASELINE_VALIDATOR.$jsonSchema.required, ["_id"]);
  assert.equal(UUID_BASELINE_VALIDATOR.$jsonSchema.properties._id.bsonType, "string");
  assert.match(UUID_BASELINE_VALIDATOR.$jsonSchema.properties._id.pattern, /4\[0-9a-f\]/);
});

test("natural-key collection is not incorrectly constrained to UUID", () => {
  assert.deepEqual(COLLECTION_VALIDATORS.game_settings, NATURAL_KEY_BASELINE_VALIDATOR);
  assert.equal(NATURAL_KEY_BASELINE_VALIDATOR.$jsonSchema.properties._id.bsonType, "string");
  assert.equal(NATURAL_KEY_BASELINE_VALIDATOR.$jsonSchema.properties._id.pattern, undefined);
  assert.equal(Object.keys(COLLECTION_VALIDATORS).length, DOMAIN_COLLECTIONS.length);
});

test("division names and codes are both unique", () => {
  const code = INDEXES.find(([, name]) => name === "uq_divisions_code");
  const name = INDEXES.find(([, indexName]) => indexName === "uq_divisions_name");
  assert.ok(code);
  assert.ok(name);
  assert.equal(code[2].unique, true);
  assert.deepEqual(code[2].keys, { code: 1 });
  assert.equal(name[2].unique, true);
  assert.deepEqual(name[2].keys, { name: 1 });
});

test("race event round is unique within season and division", () => {
  const index = INDEXES.find(([, name]) => name === "uq_race_events_season_division_round");
  assert.ok(index);
  assert.equal(index[2].unique, true);
  assert.deepEqual(index[2].keys, { season_id: 1, division_id: 1, round_number: 1 });
});

test("index names are unique per collection", () => {
  const names = INDEXES.map(([collection, name]) => `${collection}.${name}`);
  assert.equal(new Set(names).size, names.length);
});

test("source-defined field schemas cover all collections with dictionary tables", () => {
  assert.equal(Object.keys(FIELD_SCHEMA_CATALOG).length, 58);
  assert.equal(Object.keys(COLLECTION_VALIDATORS).length, DOMAIN_COLLECTIONS.length);
  assert.deepEqual(COLLECTION_VALIDATORS.players.$jsonSchema.required, [
    "_id", "username", "display_name", "active_role", "account_status",
    "level", "xp", "total_xp", "is_operator", "created_at", "updated_at",
  ]);
  assert.equal(COLLECTION_VALIDATORS.players.$jsonSchema.properties.xp.bsonType, "long");
  assert.equal(COLLECTION_VALIDATORS.players.$jsonSchema.properties.primary_team_id.bsonType[1], "null");
  assert.equal(COLLECTION_VALIDATORS.race_results.$jsonSchema.properties.points_awarded.bsonType, "decimal");
});

test("collections without field tables retain identifier-only baseline validators", () => {
  for (const name of [
    "player_sessions", "team_facilities",
    "operator_actions", "system_jobs", "system_health_logs",
  ]) {
    assert.equal(COLLECTION_VALIDATORS[name].$jsonSchema.required[0], "_id");
    assert.deepEqual(Object.keys(COLLECTION_VALIDATORS[name].$jsonSchema.properties), ["_id"]);
  }
});

test("superseded non-unique race round index is explicitly retired", () => {
  assert.deepEqual(LEGACY_INDEXES_TO_DROP, [
    ["race_events", "ix_race_events_season_division_round"],
  ]);
});

test("player and team achievements have unique participant-definition pairs", () => {
  const player = INDEXES.find(([, name]) => name === "uq_player_achievements_player_achievement");
  const team = INDEXES.find(([, name]) => name === "uq_team_achievements_team_achievement");
  assert.ok(player);
  assert.ok(team);
  assert.deepEqual(player[2].keys, { player_id: 1, achievement_id: 1 });
  assert.deepEqual(team[2].keys, { team_id: 1, achievement_id: 1 });
  assert.equal(player[2].unique, true);
  assert.equal(team[2].unique, true);
  assert.deepEqual(COLLECTION_VALIDATORS.team_achievements.$jsonSchema.properties.team_id, { bsonType: "string" });
});

test("all source-defined primary query patterns have explain coverage", () => {
  assert.equal(QUERY_PLAN_CASES.length, 38);
  for (const [collection, , , expectedIndex] of QUERY_PLAN_CASES) {
    assert.ok(DOMAIN_COLLECTIONS.includes(collection));
    assert.ok(INDEXES.some(([indexCollection, indexName]) =>
      indexCollection === collection && indexName === expectedIndex
    ), `Missing expected index definition: ${collection}.${expectedIndex}`);
  }
});

test("a player can have at most one active team membership", () => {
  const index = INDEXES.find(([, name]) => name === "uq_team_memberships_active_player");
  assert.ok(index);
  assert.equal(index[2].unique, true);
  assert.deepEqual(index[2].keys, { player_id: 1 });
  assert.deepEqual(index[2].partialFilterExpression, { status: "ACTIVE" });
});

test("a driver can have at most one active team contract", () => {
  const index = INDEXES.find(([, name]) => name === "uq_team_contracts_active_driver");
  assert.ok(index);
  assert.equal(index[2].unique, true);
  assert.deepEqual(index[2].keys, { driver_player_id: 1 });
  assert.deepEqual(index[2].partialFilterExpression, { status: "ACTIVE" });
});
