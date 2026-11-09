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
  assert.equal(INDEXES.length, 38);
  const names = INDEXES.map(([, name]) => name);
  assert.equal(new Set(names).size, names.length);
  for (const [collection] of INDEXES) {
    assert.ok(DOMAIN_COLLECTIONS.includes(collection), `Unknown collection: ${collection}`);
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
