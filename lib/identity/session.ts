import { randomUUID } from "node:crypto";
import { createOpaqueToken, hashOpaqueToken } from "./crypto.mjs";
import type { NextRequest, NextResponse } from "next/server";
import { getMongoDatabase } from "@/lib/db/mongodb";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-caleris_session" : "caleris_session";

export type SessionPrincipal = {
  playerId: string;
  discordUserId: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  displayName: string;
  avatarUrl: string | null;
  activeRole: string | null;
  isOperator: boolean;
  sessionId: string;
};


export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function createPlayerSession(input: {
  playerId: string;
  authAccountId: string;
  discordUserId: string;
  request: NextRequest;
}) {
  const db = await getMongoDatabase();
  const token = createOpaqueToken();
  const now = new Date();
  const sessionId = randomUUID();
  await db.collection("player_sessions").insertOne({
    _id: sessionId,
    player_id: input.playerId,
    auth_account_id: input.authAccountId,
    provider: "discord",
    provider_user_id: input.discordUserId,
    session_token_hash: hashOpaqueToken(token),
    status: "ACTIVE",
    issued_at: now,
    expires_at: new Date(now.getTime() + SESSION_SECONDS * 1000),
    last_seen_at: now,
    revoked_at: null,
    revocation_reason: null,
    created_at: now,
    updated_at: now,
  });
  return { token, sessionId };
}

export async function getSessionPrincipal(request: NextRequest): Promise<SessionPrincipal | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;

  const db = await getMongoDatabase();
  const now = new Date();
  const session = await db.collection("player_sessions").findOne({
    session_token_hash: hashOpaqueToken(token),
    status: "ACTIVE",
    expires_at: { $gt: now },
  });
  if (!session) return null;

  const [player, account] = await Promise.all([
    db.collection("players").findOne({ _id: session.player_id }),
    db.collection("auth_accounts").findOne({
      _id: session.auth_account_id,
      player_id: session.player_id,
      provider: "discord",
      provider_user_id: session.provider_user_id,
    }),
  ]);
  if (!player || !account || player.account_status !== "ACTIVE") return null;

  const role = typeof player.active_role === "string"
    ? await db.collection("role_assignments").findOne({
        player_id: player._id,
        role: player.active_role,
        status: "ACTIVE",
        effective_from: { $lte: now },
        $or: [{ effective_until: null }, { effective_until: { $gt: now } }, { effective_until: { $exists: false } }],
      })
    : null;

  const lastSeen = session.last_seen_at instanceof Date ? session.last_seen_at : new Date(0);
  if (now.getTime() - lastSeen.getTime() > 5 * 60 * 1000) {
    await db.collection("player_sessions").updateOne(
      { _id: session._id, status: "ACTIVE" },
      { $set: { last_seen_at: now, updated_at: now } },
    );
  }

  return {
    playerId: String(player._id),
    discordUserId: String(account.provider_user_id),
    discordUsername: typeof account.provider_username === "string" ? account.provider_username : "Discord member",
    discordAvatarUrl: typeof account.provider_avatar_url === "string" ? account.provider_avatar_url : null,
    displayName: typeof player.display_name === "string" ? player.display_name : "",
    avatarUrl: typeof player.avatar_url === "string" ? player.avatar_url : null,
    activeRole: role && typeof role.role === "string" ? role.role : null,
    isOperator: player.is_operator === true,
    sessionId: String(session._id),
  };
}

export async function revokeCurrentSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return;
  const db = await getMongoDatabase();
  const now = new Date();
  await db.collection("player_sessions").updateOne(
    { session_token_hash: hashOpaqueToken(token), status: "ACTIVE" },
    { $set: { status: "REVOKED", revoked_at: now, revocation_reason: "USER_LOGOUT", updated_at: now } },
  );
}

export async function writeAuthAudit(input: {
  action: string;
  targetType: "AUTH_ACCOUNT" | "PLAYER_SESSION" | "AUTHENTICATION";
  targetId: string;
  actorId?: string;
  actorType?: "PLAYER" | "OPERATOR" | "SYSTEM";
  reason?: string;
}) {
  const db = await getMongoDatabase();
  await db.collection("audit_logs").insertOne({
    _id: randomUUID(),
    actor_type: input.actorType ?? "SYSTEM",
    ...(input.actorId ? { actor_id: input.actorId } : {}),
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    ...(input.reason ? { reason: input.reason } : {}),
    created_at: new Date(),
  });
}
