import type { NextRequest } from "next/server";
import { AppError } from "./errors";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new AppError("INVALID_ORIGIN", "Request origin is not allowed.", 403);
  }
}
