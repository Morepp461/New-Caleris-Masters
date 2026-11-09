import test from "node:test";
import assert from "node:assert/strict";
import { assertBalancedPostings, calculateWalletBalance, canPostMoneyTransfer, defaultEconomyRules, validateEconomyRules, validateIdempotencyKey, toMinorUnits, sameIdempotentTransfer, assertBalanceProjectionMatches, canApplyVersionedDebit } from "../lib/economy/policy.mjs";

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

test("quest rewards and development rewards remain OFF until an operator enables their rules", () => {
  const defaults = defaultEconomyRules();
  assert.equal(defaults.quest_reward_rules.enabled, false);
  assert.equal(defaults.development_reward_rules.enabled, false);
  assert.equal(validateEconomyRules({ ...defaults, quest_reward_rules: { enabled: true } }).reason, "QUEST_REWARDS_REQUIRE_FUNDED_SYSTEM_ACCOUNT");
});
test("loan rules require explicit limits and block unimplemented interest accrual", () => {
  const defaults = defaultEconomyRules();
  const approvedPrincipalOnly = { enabled: true, system_account_id: "123e4567-e89b-42d3-a456-426614174000", maximum_loan_minor: 100000, eligibility_balance_minor: 5000, due_days: 30, interest_rate_bps: 0 };
  assert.equal(validateEconomyRules({ ...defaults, loan_rules: approvedPrincipalOnly }).ok, true);
  assert.equal(validateEconomyRules({ ...defaults, loan_rules: { ...approvedPrincipalOnly, interest_rate_bps: 500 } }).reason, "INTEREST_ACCRUAL_RULE_NOT_APPROVED_OR_IMPLEMENTED");
});

test("idempotent payout replay accepts only the exact same immutable transfer", () => {
  const existing = { source_account_id: "source", destination_account_id: "destination", amount_minor: "2500", category: "SALARY", currency: "CP", reason: "Approved salary payment" };
  assert.equal(sameIdempotentTransfer(existing, { sourceAccountId: "source", destinationAccountId: "destination", amountMinor: 2500, category: "SALARY", currency: "CP", reason: "Approved salary payment" }), true);
  assert.equal(sameIdempotentTransfer(existing, { sourceAccountId: "source", destinationAccountId: "destination", amountMinor: 2500, category: "PRIZE", currency: "CP", reason: "Approved salary payment" }), false);
});
test("concurrent versioned spending cannot overdraw a wallet", async () => {
  const wallet = { balance: 100, version: 7 };
  const expectedVersion = wallet.version;
  const attempts = await Promise.all(Array.from({ length: 8 }, async () => {
    await Promise.resolve();
    if (!canApplyVersionedDebit({ expectedVersion, actualVersion: wallet.version, balance: wallet.balance, amount: 30 })) return false;
    wallet.balance -= 30;
    wallet.version += 1;
    return true;
  }));
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(wallet.balance, 70);
  assert.ok(wallet.balance >= 0);
});
test("period reconciliation blocks a cached balance that differs from ledger", () => {
  assert.equal(assertBalanceProjectionMatches("650", 650), true);
  assert.throws(() => assertBalanceProjectionMatches("650", 649), /projection mismatch/);
});
