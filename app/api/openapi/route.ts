import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

const document = {
  openapi: "3.1.0",
  info: {
    title: "CALERIS MASTERS API",
    version: "1.1.0",
    description: "Phase 02 backend foundation and Phase 03 identity API.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "__Host-caleris_session" },
    },
  },
  paths: {
    "/health/live": { get: { summary: "Process liveness", responses: { "200": { description: "Process is live." } } } },
    "/health/ready": { get: { summary: "Dependency readiness", responses: { "200": { description: "MongoDB is reachable." }, "503": { description: "Required dependency is unavailable." } } } },
    "/auth/discord/start": { get: { summary: "Start Discord OAuth", responses: { "302": { description: "Redirect to Discord authorization." }, "503": { description: "Discord OAuth is not configured." } } } },
    "/auth/discord/callback": { get: { summary: "Complete Discord OAuth", responses: { "302": { description: "Redirect after identity verification." } } } },
    "/auth/session": { get: { summary: "Read current session", security: [{ sessionCookie: [] }], responses: { "200": { description: "Session identity." }, "401": { description: "No active session." } } } },
    "/auth/logout": { post: { summary: "Revoke current session", security: [{ sessionCookie: [] }], responses: { "200": { description: "Session revoked." }, "403": { description: "Invalid request origin." } } } },
    "/admin/identity/links": { post: { summary: "Operator provisions Discord identity for an existing player", security: [{ sessionCookie: [] }], responses: { "201": { description: "Identity mapping created." }, "403": { description: "Operator permission required." } } } },
    "/admin/identity/roles": { post: { summary: "Operator assigns a game role to an existing player", security: [{ sessionCookie: [] }], responses: { "201": { description: "Role assignment created." }, "403": { description: "Operator permission required." } } } },
  },
};

export function GET() {
  return NextResponse.json(document);
}
