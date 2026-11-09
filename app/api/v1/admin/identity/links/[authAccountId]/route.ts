import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getMongoClient, getMongoDatabase } from "@/lib/db/mongodb";
import { withMongoTransaction } from "@/lib/db/transactions";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StringIdDocument = { _id: string; [key: string]: any };

export const DELETE = apiHandler(async (request: NextRequest, context, meta) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request);
  await requireOperator(principal);
  const params = await context.params;
  const authAccountId = params?.authAccountId;
  if (!authAccountId) throw new AppError("INVALID_AUTH_ACCOUNT_ID", "Auth account ID is required.", 400);

  const client = await getMongoClient();
  const db = await getMongoDatabase();
  const accounts = db.collection<StringIdDocument>("auth_accounts");
  const sessionsCollection = db.collection<StringIdDocument>("player_sessions");
  const auditLogs = db.collection<StringIdDocument>("audit_logs");
  const now = new Date();

  await withMongoTransaction(client, async (session) => {
    const account = await accounts.findOne({
      _id: authAccountId,
      provider: "discord",
      status: { $ne: "REVOKED" },
    }, { session });
    if (!account) throw new AppError("AUTH_ACCOUNT_NOT_FOUND", "Active Discord identity link was not found.", 404);

    await accounts.updateOne(
      { _id: authAccountId },
      { $set: { status: "REVOKED", revoked_at: now, updated_at: now } },
      { session },
    );
    await sessionsCollection.updateMany(
      { auth_account_id: authAccountId, status: "ACTIVE" },
      { $set: { status: "REVOKED", revoked_at: now, revocation_reason: "IDENTITY_LINK_REVOKED", updated_at: now } },
      { session },
    );
    await auditLogs.insertOne({
      _id: randomUUID(),
      actor_type: "OPERATOR",
      actor_id: principal!.playerId,
      action: "IDENTITY_LINK_REVOKED",
      target_type: "AUTH_ACCOUNT",
      target_id: authAccountId,
      reason: "OPERATOR_REVOKED_DISCORD_IDENTITY",
      created_at: now,
      updated_at: now,
    }, { session });
  });

  return success({ authAccountId, status: "REVOKED" }, meta);
}, { scope: "operator-identity-revoke" });
