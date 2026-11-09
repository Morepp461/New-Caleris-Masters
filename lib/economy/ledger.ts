import { randomUUID } from "node:crypto";
import { Long, type ClientSession, type Db } from "mongodb";
import { getMongoClient, getMongoDatabase } from "@/lib/db/mongodb";
import { withMongoTransaction } from "@/lib/db/transactions";
import { AppError } from "@/lib/server/errors";
import { assertBalancedPostings, canPostMoneyTransfer, toMinorUnits, validateIdempotencyKey, validateReason, validateAccountOwner, validateEconomyRules, TOKEN_TYPES } from "./policy.mjs";

type Doc = { _id: string; [key: string]: any };
type TransferInput = { sourceAccountId: string; destinationAccountId: string; amountMinor: number; category: string; reason: string; actorId: string; idempotencyKey: string; referenceType?: string; referenceId?: string; rulesetId?: string };
const now = () => new Date();
const asLong = (value: number | string | bigint) => Long.fromString(String(value));
async function audit(db: Db, session: ClientSession, actorId: string, action: string, targetType: string, targetId: string, reason: string, after?: unknown) {
  await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: actorId, action, target_type: targetType, target_id: targetId, reason, ...(after ? { after_state: after } : {}), created_at: now(), updated_at: now() }, { session });
}
export async function createEconomyAccount(input: { ownerType: string; ownerId: string; currency?: string; actorId: string }) {
  validateAccountOwner(input.ownerType, input.ownerId);
  const db = await getMongoDatabase(), id = randomUUID(), stamp = now(), currency = input.currency ?? "CP";
  try {
    await db.collection<Doc>("economy_accounts").insertOne({ _id: id, owner_type: input.ownerType, owner_id: input.ownerId, currency, available_balance_minor: Long.ZERO, reserved_balance_minor: Long.ZERO, version: Long.fromInt(1), status: "ACTIVE", created_at: stamp, updated_at: stamp });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await db.collection<Doc>("economy_accounts").findOne({ owner_type: input.ownerType, owner_id: input.ownerId, currency });
    if (existing) return { accountId: existing._id, created: false };
    throw error;
  }
  await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: input.actorId, action: "ECONOMY_ACCOUNT_CREATED", target_type: "ECONOMY_ACCOUNT", target_id: id, reason: "Wallet account opened with zero balance.", after_state: { ownerType: input.ownerType, ownerId: input.ownerId, currency }, created_at: stamp, updated_at: stamp });
  return { accountId: id, created: true };
}
export async function postMoneyTransfer(input: TransferInput) {
  const amount = toMinorUnits(input.amountMinor), key = validateIdempotencyKey(input.idempotencyKey), reason = validateReason(input.reason);
  if (!/^[A-Z0-9_]{2,48}$/.test(input.category)) throw new AppError("INVALID_CATEGORY", "Transaction category is invalid.", 400);
  const client = await getMongoClient(), db = client.db(process.env.MONGODB_DB);
  return withMongoTransaction(client, async (session) => {
    const transactions = db.collection<Doc>("ledger_transactions"), prior = await transactions.findOne({ idempotency_key: key }, { session });
    if (prior) {
      if (prior.source_account_id !== input.sourceAccountId || prior.destination_account_id !== input.destinationAccountId || Number(prior.amount_minor) !== amount) throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different transaction.", 409);
      return { transactionId: prior._id, status: prior.status, replayed: true };
    }
    const accounts = db.collection<Doc>("economy_accounts");
    const [source, destination] = await Promise.all([accounts.findOne({ _id: input.sourceAccountId }, { session }), accounts.findOne({ _id: input.destinationAccountId }, { session })]);
    const decision = canPostMoneyTransfer({ sourceAccount: source, destinationAccount: destination, amountMinor: amount, idempotencyKey: key });
    if (!decision.ok) throw new AppError(decision.reason!, "Money transfer validation failed.", 409);
    const sourceBefore = BigInt(String(source!.available_balance_minor)), destinationBefore = BigInt(String(destination!.available_balance_minor));
    const sourceAfter = sourceBefore - BigInt(amount), destinationAfter = destinationBefore + BigInt(amount), stamp = now(), id = randomUUID();
    const debit = await accounts.updateOne({ _id: source!._id, status: "ACTIVE", version: source!.version, available_balance_minor: { $gte: asLong(amount) } }, { $inc: { available_balance_minor: asLong(-amount), version: Long.fromInt(1) }, $set: { updated_at: stamp } }, { session });
    if (debit.modifiedCount !== 1) throw new AppError("INSUFFICIENT_FUNDS", "Source wallet changed or has insufficient funds.", 409);
    const credit = await accounts.updateOne({ _id: destination!._id, status: "ACTIVE", version: destination!.version }, { $inc: { available_balance_minor: asLong(amount), version: Long.fromInt(1) }, $set: { updated_at: stamp } }, { session });
    if (credit.modifiedCount !== 1) throw new AppError("ACCOUNT_CONFLICT", "Destination wallet changed during posting.", 409);
    const postings = [{ direction: "CREDIT", amountMinor: amount, currency: source!.currency }, { direction: "DEBIT", amountMinor: amount, currency: destination!.currency }];
    assertBalancedPostings(postings);
    await transactions.insertOne({ _id: id, transaction_type: "TRANSFER", category: input.category, currency: source!.currency, amount_minor: asLong(amount), source_account_id: source!._id, destination_account_id: destination!._id, reason, reference_type: input.referenceType ?? "OPERATOR_TRANSFER", reference_id: input.referenceId ?? null, event_id: randomUUID(), idempotency_key: key, ruleset_id: input.rulesetId ?? null, status: "POSTED", description: reason, created_by: input.actorId, created_at: stamp, updated_at: stamp }, { session });
    await db.collection<Doc>("ledger_entries").insertMany([
      { _id: randomUUID(), transaction_id: id, account_id: source!._id, direction: "CREDIT", amount_minor: asLong(amount), currency: source!.currency, balance_after_minor: asLong(sourceAfter), created_at: stamp, updated_at: stamp },
      { _id: randomUUID(), transaction_id: id, account_id: destination!._id, direction: "DEBIT", amount_minor: asLong(amount), currency: destination!.currency, balance_after_minor: asLong(destinationAfter), created_at: stamp, updated_at: stamp },
    ], { session });
    await audit(db, session, input.actorId, "MONEY_TRANSFER_POSTED", "LEDGER_TRANSACTION", id, reason, { amountMinor: amount, sourceAccountId: source!._id, destinationAccountId: destination!._id, category: input.category });
    return { transactionId: id, status: "POSTED", replayed: false };
  });
}
export async function grantDevelopmentTokens(input: { ownerType: "PLAYER" | "TEAM"; ownerId: string; tokenType: "DDP" | "TDP"; amount: number; actorId: string; reason: string; idempotencyKey: string; sourceType?: string; sourceId?: string; rulesetVersion?: number }) {
  validateAccountOwner(input.ownerType, input.ownerId);
  if (!TOKEN_TYPES.includes(input.tokenType) || (input.ownerType === "PLAYER" && input.tokenType !== "DDP") || (input.ownerType === "TEAM" && input.tokenType !== "TDP")) throw new AppError("TOKEN_OWNER_MISMATCH", "Player wallets accept DDP and team wallets accept TDP.", 400);
  const amount = toMinorUnits(input.amount, "amount"), key = validateIdempotencyKey(input.idempotencyKey), reason = validateReason(input.reason);
  const client = await getMongoClient(), db = client.db(process.env.MONGODB_DB);
  return withMongoTransaction(client, async (session) => {
    const tx = db.collection<Doc>("development_transactions"), prior = await tx.findOne({ idempotency_key: key }, { session });
    if (prior) {
      if (prior.owner_id !== input.ownerId || prior.token_type !== input.tokenType || Number(prior.amount) !== amount) throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different token movement.", 409);
      return { transactionId: prior._id, balance: String(prior.balance_after), replayed: true };
    }
    const wallets = db.collection<Doc>("development_wallets");
    const wallet = await wallets.findOneAndUpdate({ owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType }, { $setOnInsert: { _id: randomUUID(), owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType, balance: Long.ZERO, version: Long.fromInt(0), created_at: now(), updated_at: now() } }, { upsert: true, returnDocument: "after", session });
    const before = BigInt(String(wallet!.balance ?? 0)), after = before + BigInt(amount), stamp = now(), id = randomUUID();
    await wallets.updateOne({ _id: wallet!._id, version: wallet!.version }, { $inc: { balance: asLong(amount), version: Long.fromInt(1) }, $set: { updated_at: stamp } }, { session });
    await tx.insertOne({ _id: id, wallet_id: wallet!._id, owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType, transaction_type: "GRANT", source_type: input.sourceType ?? "OPERATOR_ADJUSTMENT", source_id: input.sourceId ?? null, event_id: randomUUID(), idempotency_key: key, actor_id: input.actorId, reason, amount: asLong(amount), balance_before: asLong(before), balance_after: asLong(after), ruleset_version: input.rulesetVersion ?? null, created_at: stamp, updated_at: stamp }, { session });
    await audit(db, session, input.actorId, "DEVELOPMENT_TOKEN_GRANTED", "DEVELOPMENT_WALLET", wallet!._id, reason, { ownerType: input.ownerType, ownerId: input.ownerId, tokenType: input.tokenType, amount });
    return { transactionId: id, balance: after.toString(), replayed: false };
  });
}
export async function purchaseDevelopmentTokens(input: { ownerType: "PLAYER" | "TEAM"; ownerId: string; accountId: string; tokenType: "DDP" | "TDP"; amount: number; actorId: string; idempotencyKey: string; seasonId: string }) {
  validateAccountOwner(input.ownerType, input.ownerId);
  if (!TOKEN_TYPES.includes(input.tokenType) || (input.ownerType === "PLAYER" && input.tokenType !== "DDP") || (input.ownerType === "TEAM" && input.tokenType !== "TDP")) throw new AppError("TOKEN_OWNER_MISMATCH", "Player wallets purchase DDP and team wallets purchase TDP.", 400);
  const amount = toMinorUnits(input.amount, "tokenAmount"), key = validateIdempotencyKey(input.idempotencyKey);
  const db = await getMongoDatabase(), client = await getMongoClient();
  return withMongoTransaction(client, async (session) => {
    const source = await db.collection<Doc>("economy_accounts").findOne({ _id: input.accountId, owner_type: input.ownerType, owner_id: input.ownerId, currency: "CP", status: "ACTIVE" }, { session });
    if (!source) throw new AppError("OWNER_WALLET_NOT_FOUND", "The active CP wallet for this token owner was not found.", 404);
    const ruleset = await db.collection<Doc>("economy_rulesets").findOne({ season_id: input.seasonId, status: "ACTIVE" }, { sort: { version: -1 }, session });
    const validation = validateEconomyRules(ruleset ?? {});
    if (!ruleset || !validation.ok || !validation.value.token_purchase_rules.enabled) throw new AppError("TOKEN_PURCHASE_DISABLED", "Development token purchases are not enabled by an approved economy ruleset.", 403);
    const rule = validation.value.token_purchase_rules, price = input.tokenType === "DDP" ? rule.ddp_price_minor : rule.tdp_price_minor;
    if (amount < Number(rule.minimum_purchase) || !Number.isSafeInteger(price) || price <= 0 || !rule.system_account_id) throw new AppError("TOKEN_PURCHASE_INVALID", "Token purchase does not satisfy the active pricing rules.", 400);
    const existing = await db.collection<Doc>("ledger_transactions").findOne({ idempotency_key: key }, { session });
    if (existing) return { transactionId: existing._id, replayed: true };
    const cost = amount * Number(price);
    if (!Number.isSafeInteger(cost) || cost <= 0) throw new AppError("TOKEN_PRICE_OVERFLOW", "Configured token price exceeds supported integer range.", 400);
    const result = await postMoneyTransferInSession(db, session, { sourceAccountId: input.accountId, destinationAccountId: rule.system_account_id, amountMinor: cost, category: input.tokenType + "_PURCHASE", reason: input.tokenType + " purchase under approved economy ruleset " + ruleset.version + ".", actorId: input.actorId, idempotencyKey: key, rulesetId: ruleset._id });
    const token = await grantTokensInSession(db, session, { ownerType: input.ownerType, ownerId: input.ownerId, tokenType: input.tokenType, amount, actorId: input.actorId, idempotencyKey: key + ":TOKEN", sourceId: result.transactionId, rulesetVersion: ruleset.version });
    return { transactionId: result.transactionId, tokenTransactionId: token.transactionId, tokenBalance: token.balance, costMinor: cost, replayed: false };
  });
}async function grantTokensInSession(db: Db, session: ClientSession, input: { ownerType: "PLAYER" | "TEAM"; ownerId: string; tokenType: "DDP" | "TDP"; amount: number; actorId: string; idempotencyKey: string; sourceId: string; rulesetVersion: number }) {
  const wallet = await db.collection<Doc>("development_wallets").findOneAndUpdate({ owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType }, { $setOnInsert: { _id: randomUUID(), owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType, balance: Long.ZERO, version: Long.fromInt(0), created_at: now(), updated_at: now() } }, { upsert: true, returnDocument: "after", session });
  const before = BigInt(String(wallet!.balance ?? 0)), after = before + BigInt(input.amount), stamp = now(), id = randomUUID();
  await db.collection<Doc>("development_wallets").updateOne({ _id: wallet!._id, version: wallet!.version }, { $inc: { balance: asLong(input.amount), version: Long.fromInt(1) }, $set: { updated_at: stamp } }, { session });
  await db.collection<Doc>("development_transactions").insertOne({ _id: id, wallet_id: wallet!._id, owner_type: input.ownerType, owner_id: input.ownerId, token_type: input.tokenType, transaction_type: "PURCHASE", source_type: "TOKEN_PURCHASE", source_id: input.sourceId, event_id: randomUUID(), idempotency_key: input.idempotencyKey, actor_id: input.actorId, reason: "Development tokens purchased using approved ruleset.", amount: asLong(input.amount), balance_before: asLong(before), balance_after: asLong(after), ruleset_version: input.rulesetVersion, created_at: stamp, updated_at: stamp }, { session });
  return { transactionId: id, balance: after.toString() };
}
