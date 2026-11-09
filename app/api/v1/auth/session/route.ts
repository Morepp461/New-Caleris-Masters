import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/server/api-handler";
import { getSessionPrincipal } from "@/lib/identity/session";
import { success } from "@/lib/server/response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest, _context, meta) => {
  const principal = await getSessionPrincipal(request);
  if (!principal) throw new AppError("UNAUTHENTICATED", "No active session was found.", 401);
  return success({ user: principal }, meta);
}, { scope: "auth-session" });
