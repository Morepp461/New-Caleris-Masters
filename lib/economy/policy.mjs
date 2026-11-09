export const TOKEN_TYPES = Object.freeze(["DDP", "TDP"]);
export const ACCOUNT_OWNER_TYPES = Object.freeze(["PLAYER", "TEAM", "SYSTEM"]);
export function toMinorUnits(value, field = "amountMinor") {
  const raw = value && typeof value === "object" && typeof value.toString === "function" ? value.toString() : value;
  if (!(typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) && !(typeof raw === "string" && /^[1-9]\d*$/.test(raw) && BigInt(raw) <= BigInt(Number.MAX_SAFE_INTEGER))) throw new TypeError(field + " must be a positive safe integer in minor units.");
  return Number(raw);
}
export function validateIdempotencyKey(value) {
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 160) throw new TypeError("idempotencyKey must contain 8–160 characters.");
  return value.trim();
}
export function validateReason(value) {
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 500) throw new TypeError("A reason of 8–500 characters is required.");
  return value.trim();
}
export function validateAccountOwner(ownerType, ownerId) {
  if (!ACCOUNT_OWNER_TYPES.includes(ownerType)) throw new TypeError("Unsupported account owner type.");
  if (typeof ownerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) throw new TypeError("ownerId must be a UUID.");
  return true;
}
export function assertBalancedPostings(postings) {
  if (!Array.isArray(postings) || postings.length < 2) throw new TypeError("A posted transaction requires at least two ledger entries.");
  const currencies = new Set(postings.map((entry) => entry.currency));
  if (currencies.size !== 1) throw new TypeError("All postings must use the same currency.");
  let debits = 0n, credits = 0n;
  for (const entry of postings) {
    if (!["DEBIT", "CREDIT"].includes(entry.direction)) throw new TypeError("Invalid ledger direction.");
    const amount = BigInt(toMinorUnits(entry.amountMinor));
    if (entry.direction === "DEBIT") debits += amount; else credits += amount;
  }
  if (debits !== credits) throw new TypeError("Ledger debits and credits must balance exactly.");
  return { debitTotalMinor: debits.toString(), creditTotalMinor: credits.toString(), currency: [...currencies][0] };
}
export function defaultEconomyRules() {
  return { salary_rules: { enabled: false }, reward_rules: { enabled: false }, prize_rules: { enabled: false }, penalty_rules: { enabled: false }, tax_rules: { enabled: false }, fee_rules: { enabled: false }, transfer_rules: { enabled: false }, inactive_penalty_rules: { enabled: false }, spending_cap_rules: { enabled: false }, limits_rules: { enabled: false }, maintenance_rules: { enabled: false }, loan_rules: { enabled: false }, token_purchase_rules: { enabled: false, minimum_purchase: 10 } };
}
export function validateEconomyRules(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "INVALID_RULESET" };
  const defaults = defaultEconomyRules(), normalized = {};
  for (const key of Object.keys(defaults)) {
    const rule = input[key] ?? defaults[key];
    if (!rule || typeof rule !== "object" || Array.isArray(rule) || typeof rule.enabled !== "boolean") return { ok: false, reason: "INVALID_" + key.toUpperCase() };
    const copy = { ...rule };
    for (const [field, value] of Object.entries(copy)) {
      if (field === "enabled") continue;
      if (field === "system_account_id") { if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) return { ok: false, reason: "INVALID_SYSTEM_ACCOUNT" }; }
      else if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return { ok: false, reason: "INVALID_" + field.toUpperCase() };
      else if (value !== null && typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") return { ok: false, reason: "INVALID_" + field.toUpperCase() };
    }
    if (key === "loan_rules" && copy.enabled && (!copy.system_account_id || !Number.isSafeInteger(copy.maximum_loan_minor) || copy.maximum_loan_minor <= 0 || !Number.isSafeInteger(copy.eligibility_balance_minor) || copy.eligibility_balance_minor < 0 || !Number.isSafeInteger(copy.due_days) || copy.due_days <= 0 || !Number.isSafeInteger(copy.interest_rate_bps) || copy.interest_rate_bps < 0)) return { ok: false, reason: "LOAN_RULES_REQUIRE_APPROVED_LIMITS_DUE_DAYS_RATE_AND_SYSTEM_ACCOUNT" };
    if (key === "token_purchase_rules") {
      copy.minimum_purchase ??= 10;
      if (!Number.isSafeInteger(copy.minimum_purchase) || copy.minimum_purchase < 10) return { ok: false, reason: "INVALID_TOKEN_MINIMUM" };
      if (copy.enabled && (!Number.isSafeInteger(copy.ddp_price_minor) || copy.ddp_price_minor <= 0 || !Number.isSafeInteger(copy.tdp_price_minor) || copy.tdp_price_minor <= 0 || !copy.system_account_id)) return { ok: false, reason: "TOKEN_PURCHASE_REQUIRES_APPROVED_PRICES_AND_SYSTEM_ACCOUNT" };
    }
    normalized[key] = copy;
  }
  return { ok: true, value: normalized };
}
export function calculateWalletBalance(entries) {
  let balance = 0n;
  for (const entry of entries) {
    const amount = BigInt(toMinorUnits(entry.amount_minor));
    if (entry.direction === "DEBIT") balance += amount;
    else if (entry.direction === "CREDIT") balance -= amount;
    else throw new TypeError("Invalid ledger direction.");
  }
  if (balance < 0n) throw new Error("Ledger-derived wallet balance cannot be negative.");
  return balance.toString();
}
export function canPostMoneyTransfer({ sourceAccount, destinationAccount, amountMinor, idempotencyKey }) {
  try {
    toMinorUnits(amountMinor); validateIdempotencyKey(idempotencyKey);
    if (!sourceAccount || !destinationAccount || sourceAccount._id === destinationAccount._id) return { ok: false, reason: "INVALID_ACCOUNT_PAIR" };
    if (sourceAccount.currency !== destinationAccount.currency) return { ok: false, reason: "CURRENCY_MISMATCH" };
    if (sourceAccount.status !== "ACTIVE" || destinationAccount.status !== "ACTIVE") return { ok: false, reason: "ACCOUNT_NOT_ACTIVE" };
    if (BigInt(String(sourceAccount.available_balance_minor)) < BigInt(amountMinor)) return { ok: false, reason: "INSUFFICIENT_FUNDS" };
    return { ok: true };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : "INVALID_TRANSFER" }; }
}
