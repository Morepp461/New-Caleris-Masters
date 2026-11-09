import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/server/api-handler";
import { buildDiscordAuthorizationUrl, createOAuthState, getOAuthStateCookieName } from "@/lib/identity/discord-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (_request: NextRequest) => {
  const state = createOAuthState();
  let authorizationUrl: URL;
  try {
    authorizationUrl = buildDiscordAuthorizationUrl(state);
  } catch {
    return NextResponse.redirect(new URL("/?auth=not-configured", _request.url));
  }
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(getOAuthStateCookieName(), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}, { scope: "discord-oauth-start" });
