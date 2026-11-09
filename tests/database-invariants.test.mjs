import test from "node:test";
import assert from "node:assert/strict";
import {
  assertBalancedLedgerTotals,
  assertNonNegativeBalances,
  assertReferencesExist,
  assertUniqueIdempotencyKeys,
  assertUniqueIds,
} from "../scripts/db/invariants.mjs";

test("immutable IDs are present and unique", () => {
  assert.equal(assertUniqueIds([{ _id: "a" }, { _id: "b" }]), true);
  assert.throws(() => assertUniqueIds([{ _id: "a" }, { _id: "a" }]), /Duplicate identifier/);
  assert.throws(() => assertUniqueIds([{ _id: null }]), /Missing immutable identifier/);
});

test("references must resolve to existing target IDs", () => {
  assert.equal(assertReferencesExist([{ player_id: "p1" }], "player_id", ["p1", "p2"]), true);
  assert.equal(assertReferencesExist([{ player_id: null }], "player_id", [], { allowNull: true }), true);
  assert.throws(
    () => assertReferencesExist([{ player_id: "missing" }], "player_id", ["p1"]),
    /Unresolved reference/,
  );
});

test("economy balances reject negative values and preserve integer precision", () => {
  assert.equal(assertNonNegativeBalances({
    availableBalanceMinor: 9007199254740993n,
    reservedBalanceMinor: 0n,
  }), true);
  assert.throws(() => assertNonNegativeBalances({ availableBalanceMinor: -1n }), /cannot be negative/);
  assert.throws(() => assertNonNegativeBalances({ availableBalanceMinor: 1.5 }), /must be an integer/);
});

test("ledger posting totals must balance exactly", () => {
  assert.equal(assertBalancedLedgerTotals(10000000000000001n, 10000000000000001n), true);
  assert.throws(() => assertBalancedLedgerTotals(100n, 99n), /must balance/);
  assert.throws(() => assertBalancedLedgerTotals(-1n, 0n), /cannot be negative/);
});

test("idempotency keys must be unique", () => {
  assert.equal(assertUniqueIdempotencyKeys([
    { idempotency_key: "event-1" },
    { idempotency_key: "event-2" },
  ]), true);
  assert.throws(() => assertUniqueIdempotencyKeys([
    { idempotency_key: "event-1" },
    { idempotency_key: "event-1" },
  ]), /Duplicate idempotency key/);
});
