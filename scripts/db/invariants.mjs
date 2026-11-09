function toIntegerBigInt(value, label) {
  try {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new TypeError();
    }
    if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
      throw new TypeError();
    }
    return BigInt(value);
  } catch {
    throw new TypeError(`${label} must be an integer minor-unit value.`);
  }
}

export function assertUniqueIds(records, field = "_id") {
  const seen = new Set();
  for (const record of records) {
    const value = record?.[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Missing immutable identifier: ${field}.`);
    }
    if (seen.has(value)) throw new Error(`Duplicate identifier in ${field}: ${value}.`);
    seen.add(value);
  }
  return true;
}

export function assertReferencesExist(records, field, targetIds, { allowNull = false } = {}) {
  const targets = new Set(targetIds);
  for (const record of records) {
    const value = record?.[field];
    if (value == null && allowNull) continue;
    if (typeof value !== "string" || !targets.has(value)) {
      throw new Error(`Unresolved reference in ${field}: ${String(value)}.`);
    }
  }
  return true;
}

export function assertNonNegativeBalances({ availableBalanceMinor, reservedBalanceMinor = 0 }) {
  const available = toIntegerBigInt(availableBalanceMinor, "availableBalanceMinor");
  const reserved = toIntegerBigInt(reservedBalanceMinor, "reservedBalanceMinor");
  if (available < 0n || reserved < 0n) {
    throw new Error("Economy balances cannot be negative.");
  }
  return true;
}

export function assertBalancedLedgerTotals(debitTotalMinor, creditTotalMinor) {
  const debit = toIntegerBigInt(debitTotalMinor, "debitTotalMinor");
  const credit = toIntegerBigInt(creditTotalMinor, "creditTotalMinor");
  if (debit < 0n || credit < 0n) {
    throw new Error("Ledger posting totals cannot be negative.");
  }
  if (debit !== credit) {
    throw new Error("Posted ledger transaction must balance.");
  }
  return true;
}

export function assertUniqueIdempotencyKeys(records, field = "idempotency_key") {
  return assertUniqueIds(records, field);
}
