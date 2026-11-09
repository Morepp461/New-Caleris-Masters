import test from "node:test";
import assert from "node:assert/strict";
import { assertBalancedPostings, calculateWalletBalance, canPostMoneyTransfer, defaultEconomyRules, validateEconomyRules, validateIdempotencyKey, toMinorUnits } from "../lib/economy/policy.mjs";

test("double-entry postings balance per currency", () => {
  assert.deepEqual(assertBalancedPostings([{ direction: "CREDIT", amountMinor: 12500, currency: "CP" }, { direction: "DEBIT", amountMinor: 12500, currency: "CP" }]), { debitTotalMinor: "12500", creditTotalMinor: "12500", currency: "CP" });
  assert.throws(() => assertBalancedPostings([{ direction: "DEBIT", amountMinor: 10, currency: "CP" }, { direction: "CREDIT", amountMinor: 9, currency: "CP" }]), /balance exactly/);
  assert.throws(() => assertBalancedPostings([{ direction: "DEBIT", amountMinor: 10, currency: "CP" }, { direction: "CREDIT", amountMinor: 10, currency: "DDP" }]), /same currency/);
});
test("money and token amounts are positive integer minor units", () => {
  assert.equal(toMinorUnits("100"), 100);
  assert.throws(() => toMinorUnits(0), /positive safe integer/);
  assert.throws(() => toMinorUnits(1.25), /positive safe integer/);
});
test("idempotency keys are bounded", () => {
  assert.equal(validateIdempotencyKey("quest-claim-001"), "quest-claim-001");
  assert.throws(() => validateIdempotencyKey("x"), /8–160/);
});
test("economy rules default OFF and token purchase requires approved pricing", () => {
  const defaults = defaultEconomyRules();
  assert.ok(Object.values(defaults).every((rule) => rule.enabled === false));
  assert.equal(validateEconomyRules(defaults).ok, true);
  assert.equal(validateEconomyRules({ ...defaults, token_purchase_rules: { enabled: true } }).reason, "TOKEN_PURCHASE_REQUIRES_APPROVED_PRICES_AND_SYSTEM_ACCOUNT");
});
test("wallet balance is derived from immutable entries", () => {
  assert.equal(calculateWalletBalance([{ direction: "DEBIT", amount_minor: 100 }, { direction: "CREDIT", amount_minor: 35 }]), "65");
  assert.throws(() => calculateWalletBalance([{ direction: "CREDIT", amount_minor: 1 }]), /cannot be negative/);
});
test("transfer policy rejects frozen, mismatched and underfunded accounts", () => {
  const source = { _id: "a", currency: "CP", status: "ACTIVE", available_balance_minor: 100 }, destination = { _id: "b", currency: "CP", status: "ACTIVE", available_balance_minor: 0 };
  assert.equal(canPostMoneyTransfer({ sourceAccount: source, destinationAccount: destination, amountMinor: 50, idempotencyKey: "transfer-001" }).ok, true);
  assert.equal(canPostMoneyTransfer({ sourceAccount: source, destinationAccount: { ...destination, currency: "DDP" }, amountMinor: 50, idempotencyKey: "transfer-002" }).reason, "CURRENCY_MISMATCH");
  assert.equal(canPostMoneyTransfer({ sourceAccount: source, destinationAccount: destination, amountMinor: 101, idempotencyKey: "transfer-003" }).reason, "INSUFFICIENT_FUNDS");
  assert.equal(canPostMoneyTransfer({ sourceAccount: { ...source, status: "FROZEN" }, destinationAccount: destination, amountMinor: 10, idempotencyKey: "transfer-004" }).reason, "ACCOUNT_NOT_ACTIVE");
});
