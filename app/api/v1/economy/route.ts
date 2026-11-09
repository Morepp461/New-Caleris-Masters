import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getMongoDatabase } from "@/lib/db/mongodb";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";
import { requireJsonObject, readString } from "@/lib/server/validation";
import { createEconomyAccount, postMoneyTransfer, grantDevelopmentTokens, purchaseDevelopmentTokens, closeEconomyPeriod, postConfiguredMoneyMovement, issueTeamLoan, repayTeamLoan, reverseMoneyTransaction, activateEconomyRuleset } from "@/lib/economy/ledger";
import { defaultEconomyRules, validateEconomyRules } from "@/lib/economy/policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { _id: string; [key: string]: any };

export const GET = apiHandler(async (request: NextRequest, _context, meta) => {
  const principal = await getSessionPrincipal(request);
  if (!principal) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);
  const db = await getMongoDatabase(), operator = principal.isOperator;
  const team = await db.collection<Doc>("teams").findOne({ owner_player_id: principal.playerId, status: "ACTIVE" });
  const owners = [{ owner_type: "PLAYER", owner_id: principal.playerId }, ...(team ? [{ owner_type: "TEAM", owner_id: team._id }] : [])];
  const accounts = await db.collection<Doc>("economy_accounts").find(operator ? {} : { $or: owners }).sort({ updated_at: -1 }).limit(operator ? 250 : 10).toArray();
  const accountIds = accounts.map((item) => item._id);
  const ledgerBalances = accountIds.length ? await db.collection<Doc>("ledger_entries").aggregate([
    { $match: { account_id: { $in: accountIds } } },
    { $group: { _id: "$account_id", debit: { $sum: { $cond: [{ $eq: ["$direction", "DEBIT"] }, "$amount_minor", 0] } }, credit: { $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount_minor", 0] } } } },
    { $project: { account_id: "$_id", balance_minor: { $subtract: ["$debit", "$credit"] } } },
  ]).toArray() : [];
  const accountViews = accounts.map((account) => {
    const ledgerBalance = ledgerBalances.find((row) => row.account_id === account._id)?.balance_minor ?? 0;
    const derived = BigInt(String(ledgerBalance)).toString();
    return { ...account, available_balance_minor: derived, ledger_cache_consistent: derived === String(account.available_balance_minor) };
  });
  const [tokens, transactions, tokenTransactions, rulesets, periods, loans, seasons] = await Promise.all([
    db.collection<Doc>("development_wallets").find(operator ? {} : { $or: owners }).sort({ updated_at: -1 }).limit(operator ? 250 : 10).toArray(),
    db.collection<Doc>("ledger_transactions").find(operator ? {} : { $or: [{ source_account_id: { $in: accountIds } }, { destination_account_id: { $in: accountIds } }] }).sort({ created_at: -1 }).limit(100).toArray(),
    db.collection<Doc>("development_transactions").find(operator ? {} : { $or: owners }).sort({ created_at: -1 }).limit(100).toArray(),
    operator ? db.collection<Doc>("economy_rulesets").find({}).sort({ created_at: -1 }).limit(50).toArray() : [],
    operator ? db.collection<Doc>("economy_periods").find({}).sort({ start_at: -1 }).limit(50).toArray() : [],
    db.collection<Doc>("loans").find(operator ? {} : { team_id: team?._id ?? "__none__" }).sort({ created_at: -1 }).limit(operator ? 200 : 20).toArray(),
    operator ? db.collection<Doc>("seasons").find({}).sort({ season_number: -1 }).limit(50).toArray() : [],
  ]);
  return success({ operator, accounts: accountViews, developmentWallets: tokens, transactions, developmentTransactions: tokenTransactions, rulesets, periods, loans, seasons, economyActivation: "OFF_UNTIL_APPROVED" }, meta);
}, { scope: "economy-read" });

export const POST = apiHandler(async (request: NextRequest, _context, meta) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request);
  if (!principal) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);
  const body = requireJsonObject(await request.json()), action = readString(body.action, "action", { max: 40 }).toUpperCase();
  const db = await getMongoDatabase(), actorId = principal.playerId;
  if (action === "PURCHASE_TOKENS") {
    const tokenType = readString(body.tokenType, "tokenType", { max: 8 }).toUpperCase();
    if (tokenType === "DDP") {
      return success(await purchaseDevelopmentTokens({ ownerType: "PLAYER", ownerId: actorId, accountId: readString(body.accountId, "accountId", { max: 64 }), tokenType: "DDP", amount: Number(body.amount), actorId, idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }), seasonId: readString(body.seasonId, "seasonId", { max: 64 }) }), meta, 201);
    }
    if (tokenType === "TDP") {
      const team = await db.collection<Doc>("teams").findOne({ owner_player_id: actorId, status: "ACTIVE" });
      if (!team) throw new AppError("TEAM_OWNERSHIP_REQUIRED", "An active team owner is required to purchase TDP.", 403);
      return success(await purchaseDevelopmentTokens({ ownerType: "TEAM", ownerId: team._id, accountId: readString(body.accountId, "accountId", { max: 64 }), tokenType: "TDP", amount: Number(body.amount), actorId, idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }), seasonId: readString(body.seasonId, "seasonId", { max: 64 }) }), meta, 201);
    }
    throw new AppError("INVALID_TOKEN_TYPE", "Token type must be DDP or TDP.", 400);
  }
  await requireOperator(principal);
  if (action === "REVERSE_TRANSACTION") {
    const result = await reverseMoneyTransaction({
      transactionId: readString(body.transactionId, "transactionId", { max: 64 }),
      actorId,
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "RULED_MOVEMENT") {
    const result = await postConfiguredMoneyMovement({
      sourceAccountId: readString(body.sourceAccountId, "sourceAccountId", { max: 64 }),
      destinationAccountId: readString(body.destinationAccountId, "destinationAccountId", { max: 64 }),
      amountMinor: Number(body.amountMinor),
      category: readString(body.category, "category", { max: 48 }).toUpperCase(),
      ruleGroup: readString(body.ruleGroup, "ruleGroup", { max: 48 }),
      seasonId: readString(body.seasonId, "seasonId", { max: 64 }),
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      actorId,
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
      referenceType: typeof body.referenceType === "string" ? body.referenceType.slice(0, 48) : undefined,
      referenceId: typeof body.referenceId === "string" ? body.referenceId.slice(0, 64) : undefined,
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "ISSUE_LOAN") {
    const result = await issueTeamLoan({
      teamId: readString(body.teamId, "teamId", { max: 64 }),
      teamAccountId: readString(body.teamAccountId, "teamAccountId", { max: 64 }),
      amountMinor: Number(body.amountMinor),
      seasonId: readString(body.seasonId, "seasonId", { max: 64 }),
      actorId,
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "REPAY_LOAN") {
    const result = await repayTeamLoan({
      loanId: readString(body.loanId, "loanId", { max: 64 }),
      teamAccountId: readString(body.teamAccountId, "teamAccountId", { max: 64 }),
      amountMinor: Number(body.amountMinor),
      actorId,
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "CREATE_ACCOUNT") {
    const result = await createEconomyAccount({ ownerType: readString(body.ownerType, "ownerType", { max: 16 }).toUpperCase(), ownerId: readString(body.ownerId, "ownerId", { max: 64 }), currency: "CP", actorId });
    return success(result, meta, result.created ? 201 : 200);
  }
  if (action === "TRANSFER" || action === "ADJUSTMENT") {
    const result = await postMoneyTransfer({
      sourceAccountId: readString(body.sourceAccountId, "sourceAccountId", { max: 64 }),
      destinationAccountId: readString(body.destinationAccountId, "destinationAccountId", { max: 64 }),
      amountMinor: Number(body.amountMinor),
      category: action === "ADJUSTMENT" ? "OPERATOR_ADJUSTMENT" : readString(body.category, "category", { max: 48 }).toUpperCase(),
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      actorId,
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
      referenceType: typeof body.referenceType === "string" ? body.referenceType.slice(0, 48) : undefined,
      referenceId: typeof body.referenceId === "string" ? body.referenceId.slice(0, 64) : undefined,
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "GRANT_TOKENS") {
    const result = await grantDevelopmentTokens({
      ownerType: readString(body.ownerType, "ownerType", { max: 16 }).toUpperCase() as "PLAYER" | "TEAM",
      ownerId: readString(body.ownerId, "ownerId", { max: 64 }),
      tokenType: readString(body.tokenType, "tokenType", { max: 8 }).toUpperCase() as "DDP" | "TDP",
      amount: Number(body.amount), actorId,
      reason: readString(body.reason, "reason", { min: 8, max: 500 }),
      idempotencyKey: readString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 160 }),
      sourceType: "OPERATOR_ADJUSTMENT",
    });
    return success(result, meta, result.replayed ? 200 : 201);
  }
  if (action === "CREATE_RULESET") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 });
    if (!await db.collection<Doc>("seasons").findOne({ _id: seasonId })) throw new AppError("SEASON_NOT_FOUND", "Season was not found.", 404);
    const previous = await db.collection<Doc>("economy_rulesets").find({ season_id: seasonId }).sort({ version: -1 }).toArray();
    const id = randomUUID(), stamp = new Date(), rules = defaultEconomyRules(), version = Number(previous[0]?.version ?? 0) + 1;
    await db.collection<Doc>("economy_rulesets").insertOne({ _id: id, season_id: seasonId, version, status: "DRAFT", ...rules, created_by: actorId, created_at: stamp, updated_at: stamp });
    await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: actorId, action: "ECONOMY_RULESET_CREATED", target_type: "ECONOMY_RULESET", target_id: id, reason: "Draft created with all economic rules disabled.", created_at: stamp, updated_at: stamp });
    return success({ rulesetId: id, version, status: "DRAFT", rules }, meta, 201);
  }
  if (action === "UPDATE_RULESET") {
    const rulesetId = readString(body.rulesetId, "rulesetId", { max: 64 }), rules = validateEconomyRules(body.rules);
    if (!rules.ok) throw new AppError("INVALID_ECONOMY_RULES", rules.reason!, 400);
    const existing = await db.collection<Doc>("economy_rulesets").findOne({ _id: rulesetId, status: "DRAFT" });
    if (!existing) throw new AppError("RULESET_NOT_DRAFT", "Only a draft economy ruleset can be changed.", 409);
    await db.collection<Doc>("economy_rulesets").updateOne({ _id: rulesetId, status: "DRAFT" }, { $set: { ...rules.value, updated_at: new Date(), updated_by: actorId } });
    await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: actorId, action: "ECONOMY_RULESET_UPDATED", target_type: "ECONOMY_RULESET", target_id: rulesetId, reason: "Versioned economy configuration updated.", before_state: existing, after_state: rules.value, created_at: new Date(), updated_at: new Date() });
    return success({ rulesetId, updated: true }, meta);
  }
  if (action === "ACTIVATE_RULESET") {
    return success(await activateEconomyRuleset({ rulesetId: readString(body.rulesetId, "rulesetId", { max: 64 }), actorId }), meta);
  }
  if (action === "CREATE_PERIOD") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 }), periodNumber = Number(body.periodNumber), startAt = new Date(String(body.startAt)), endAt = new Date(String(body.endAt));
    if (!Number.isSafeInteger(periodNumber) || periodNumber < 1 || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) throw new AppError("INVALID_PERIOD", "Period number and date range are invalid.", 400);
    if (!await db.collection<Doc>("seasons").findOne({ _id: seasonId })) throw new AppError("SEASON_NOT_FOUND", "Season was not found.", 404);
    const id = randomUUID(), stamp = new Date();
    await db.collection<Doc>("economy_periods").insertOne({ _id: id, season_id: seasonId, period_number: periodNumber, start_at: startAt, end_at: endAt, status: "OPEN", created_by: actorId, created_at: stamp, updated_at: stamp });
    await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: actorId, action: "ECONOMY_PERIOD_CREATED", target_type: "ECONOMY_PERIOD", target_id: id, reason: "Economy period opened.", created_at: stamp, updated_at: stamp });
    return success({ periodId: id, status: "OPEN" }, meta, 201);
  }
  if (action === "CLOSE_PERIOD") {
    return success(await closeEconomyPeriod({ periodId: readString(body.periodId, "periodId", { max: 64 }), actorId, reason: readString(body.reason, "reason", { min: 8, max: 500 }) }), meta);
  }
  throw new AppError("UNKNOWN_ECONOMY_ACTION", "Unsupported economy action.", 400);
}, { scope: "operator-economy" });
