import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { Document } from "mongodb";
import { getMongoClient, getMongoDatabase } from "@/lib/db/mongodb";
import { withMongoTransaction } from "@/lib/db/transactions";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { readString, requireJsonObject } from "@/lib/server/validation";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";

const ALLOWED_ROLES = new Set(["DRIVER", "PRINCIPAL", "OWNER", "AGENT", "JOURNALIST", "FIA"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StringIdDocument = Document & { _id: string };

export const POST = apiHandler(async (request: NextRequest, _context, meta) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request);
  await requireOperator(principal);
  const body = requireJsonObject(await request.json());
  const playerId = readString(body.playerId, "playerId", { max: 64 });
  const role = readString(body.role, "role", { max: 32 }).toUpperCase();
  const reason = readString(body.reason, "reason", { min: 3, max: 300 });
  if (!ALLOWED_ROLES.has(role)) throw new AppError("INVALID_ROLE", "Role is not assignable through this endpoint.", 400);

  const client = await getMongoClient();
  const db = await getMongoDatabase();
  const players = db.collection<StringIdDocument>("players");
  const assignments = db.collection<StringIdDocument>("role_assignments");
  const auditLogs = db.collection<StringIdDocument>("audit_logs");
  const assignmentId = randomUUID();
  const now = new Date();

  await withMongoTransaction(client, async (session) => {
    const player = await players.findOne({ _id: playerId, account_status: "ACTIVE" }, { session });
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Active player was not found.", 404);

    await assignments.updateMany(
      { player_id: playerId, status: "ACTIVE" },
      { $set: { status: "REVOKED", effective_until: now, updated_at: now } },
      { session },
    );
    await assignments.insertOne({
      _id: assignmentId,
      player_id: playerId,
      role,
      status: "ACTIVE",
      effective_from: now,
      created_at: now,
      updated_at: now,
      approved_by: principal!.playerId,
      change_reason: reason,
    }, { session });
    await players.updateOne(
      { _id: playerId },
      { $set: { active_role: role, updated_at: now } },
      { session },
    );
    await auditLogs.insertOne({
      _id: randomUUID(),
      actor_type: "OPERATOR",
      actor_id: principal!.playerId,
      action: "ROLE_ASSIGNMENT_CREATED",
      target_type: "PLAYER",
      target_id: playerId,
      reason,
      created_at: now,
      updated_at: now,
    }, { session });
  });

  return success({ assignmentId, playerId, role, status: "ACTIVE" }, meta, 201);
}, { scope: "operator-role-assignment" });
