import { createOAuthState, verifyOAuthState } from "./crypto.mjs";
import { AppError } from "@/lib/server/errors";

const STATE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-caleris_oauth_state" : "caleris_oauth_state";

export function getDiscordOAuthConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError("AUTH_NOT_CONFIGURED", "Discord login is not configured yet.", 503);
  }
  return { clientId, clientSecret, redirectUri };
}

export function getOAuthStateCookieName() {
  return STATE_COOKIE;
}

export function buildDiscordAuthorizationUrl(state: string) {
  const config = getDiscordOAuthConfig();
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  return url;
}

type DiscordProfile = { id: string; username: string; avatar: string | null; global_name?: string | null; email?: string; verified?: boolean };

export async function exchangeDiscordCode(code: string): Promise<DiscordProfile> {
  const config = getDiscordOAuthConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!tokenResponse.ok) throw new AppError("OAUTH_EXCHANGE_FAILED", "Discord authorization could not be completed.", 401);
  const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
  if (!token.access_token) throw new AppError("OAUTH_EXCHANGE_FAILED", "Discord did not return an access token.", 401);

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `${token.token_type ?? "Bearer"} ${token.access_token}` },
    cache: "no-store",
  });
  if (!profileResponse.ok) throw new AppError("OAUTH_PROFILE_FAILED", "Discord identity could not be verified.", 401);
  const profile = await profileResponse.json() as DiscordProfile;
  if (!profile.id || !profile.username || !profile.email || profile.verified !== true) throw new AppError("OAUTH_PROFILE_INVALID", "Discord did not return a verified identity and email.", 401);
  return profile;
}

export function discordAvatarUrl(profile: DiscordProfile) {
  if (!profile.avatar) return null;
  const extension = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.${extension}`;
}
