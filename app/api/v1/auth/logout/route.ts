import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/server/api-handler";
import { clearSessionCookie, getSessionPrincipal, revokeCurrentSession, writeAuthAudit } from "@/lib/identity/session";
import { assertSameOrigin } from "@/lib/server/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request);
  await revokeCurrentSession(request);
  if (principal) {
    await writeAuthAudit({
      action: "AUTH_LOGOUT",
      targetType: "PLAYER_SESSION",
      targetId: principal.sessionId,
      actorId: principal.playerId,
      actorType: principal.isOperator ? "OPERATOR" : "PLAYER",
    });
  }
  const response = NextResponse.json({ success: true, data: { loggedOut: true } });
  clearSessionCookie(response);
  return response;
}, { scope: "auth-logout" });
