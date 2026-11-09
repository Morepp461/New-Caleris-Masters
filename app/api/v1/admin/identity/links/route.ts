import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getMongoClient, getMongoDatabase } from "@/lib/db/mongodb";
import { withMongoTransaction } from "@/lib/db/transactions";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { readString, requireJsonObject } from "@/lib/server/validation";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (request: NextRequest, _context, meta) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request);
  await requireOperator(principal);
  const body = requireJsonObject(await request.json());
  const playerId = readString(body.playerId, "playerId", { max: 64 });
  const discordUserId = readString(body.discordUserId, "discordUserId", { min: 17, max: 20 });
  const reason = readString(body.reason, "reason", { min: 3, max: 300 });
  if (!/^\d{17,20}$/.test(discordUserId)) throw new AppError("INVALID_DISCORD_ID", "Discord user ID must be a numeric snowflake.", 400);
  const client = await getMongoClient();
  const db = await getMongoDatabase();
  const authAccountId = randomUUID();
  const now = new Date();

  await withMongoTransaction(client, async (session) => {
    const player = await db.collection("players").findOne({ _id: playerId, account_status: "ACTIVE" }, { session });
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Active player was not found.", 404);
    const existingDiscord = await db.collection("auth_accounts").findOne({ provider: "discord", provider_user_id: discordUserId }, { session });
    if (existingDiscord) throw new AppError("DISCORD_IDENTITY_ALREADY_LINKED", "This Discord identity is already linked.", 409);
    const existingPlayerLink = await db.collection("auth_accounts").findOne({ provider: "discord", player_id: playerId, status: { $ne: "REVOKED" } }, { session });
    if (existingPlayerLink) throw new AppError("PLAYER_ALREADY_LINKED", "This player already has a Discord identity.", 409);

    await db.collection("auth_accounts").insertOne({
      _id: authAccountId,
      player_id: playerId,
      provider: "discord",
      provider_user_id: discordUserId,
      status: "PENDING",
      provider_email: "",
      linked_at: now,
    }, { session });
    await db.collection("audit_logs").insertOne({
      _id: randomUUID(),
      actor_type: "OPERATOR",
      actor_id: principal!.playerId,
      action: "IDENTITY_LINK_CREATED",
      target_type: "AUTH_ACCOUNT",
      target_id: authAccountId,
      reason,
      created_at: now,
    }, { session });
  });

  return success({ authAccountId, playerId, status: "PENDING_FIRST_LOGIN" }, meta, 201);
}, { scope: "operator-identity-link" });
