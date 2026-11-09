import { NextRequest, NextResponse } from "next/server";
import { getMongoDatabase } from "@/lib/db/mongodb";
import { createPlayerSession, setSessionCookie, writeAuthAudit } from "@/lib/identity/session";
import {
  discordAvatarUrl,
  exchangeDiscordCode,
  type DiscordProfile,
  getOAuthStateCookieName,
  verifyOAuthState,
} from "@/lib/identity/discord-oauth";
import { randomUUID } from "node:crypto";
import { apiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const stateName = getOAuthStateCookieName();
  const expectedState = request.cookies.get(stateName)?.value;
  const receivedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const stateValid = verifyOAuthState(expectedState, receivedState);

  const redirect = (status: string) => {
    const response = NextResponse.redirect(new URL(`/?auth=${status}`, request.url));
    response.cookies.set(stateName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (!stateValid || !code) return redirect("oauth-denied");

  let profile: DiscordProfile;
  try {
    profile = await exchangeDiscordCode(code);
  } catch {
    return redirect("oauth-failed");
  }
  const db = await getMongoDatabase();
  const account = await db.collection("auth_accounts").findOne({
    provider: "discord",
    provider_user_id: profile.id,
    status: { $ne: "REVOKED" },
  });

  if (!account) {
    await writeAuthAudit({
      action: "AUTH_LOGIN_DENIED_UNLINKED_DISCORD",
      targetType: "AUTHENTICATION",
      targetId: randomUUID(),
      reason: "DISCORD_IDENTITY_NOT_PROVISIONED",
    });
    return redirect("account-not-provisioned");
  }

  const player = await db.collection("players").findOne({ _id: account.player_id });
  if (!player || player.account_status !== "ACTIVE") {
    await writeAuthAudit({
      action: "AUTH_LOGIN_DENIED_INACTIVE_PLAYER",
      targetType: "AUTH_ACCOUNT",
      targetId: String(account._id),
      actorId: String(account.player_id),
      actorType: "SYSTEM",
      reason: "PLAYER_NOT_ACTIVE",
    });
    return redirect("account-unavailable");
  }

  const now = new Date();
  const avatarUrl = discordAvatarUrl(profile);
  await db.collection("auth_accounts").updateOne(
    { _id: account._id },
    {
      $set: {
        provider_email: profile.email,
        status: "ACTIVE",
        provider_username: profile.username,
        provider_avatar_url: avatarUrl,
        last_authenticated_at: now,
      },
    },
  );

  const session = await createPlayerSession({
    playerId: String(player._id),
    authAccountId: String(account._id),
    discordUserId: profile.id,
    request,
  });
  await writeAuthAudit({
    action: "AUTH_LOGIN_SUCCEEDED",
    targetType: "PLAYER_SESSION",
    targetId: session.sessionId,
    actorId: String(player._id),
    actorType: player.is_operator === true ? "OPERATOR" : "PLAYER",
  });

  const response = redirect("success");
  setSessionCookie(response, session.token);
  return response;
}, { scope: "discord-oauth-callback" });
