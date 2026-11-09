import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_COLLECTIONS, INDEXES, UUID_BASELINE_VALIDATOR } from "../scripts/db/collections.mjs";

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
  assert.equal(INDEXES.length, 40);
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

test("UUID baseline validator requires only immutable string _id", () => {
  assert.deepEqual(UUID_BASELINE_VALIDATOR.$jsonSchema.required, ["_id"]);
  assert.equal(UUID_BASELINE_VALIDATOR.$jsonSchema.properties._id.bsonType, "string");
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
