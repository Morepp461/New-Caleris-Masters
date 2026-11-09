import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getRuleset, saveRuleset } from "@/lib/economy-rules";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const season = Number(request.nextUrl.searchParams.get("season") ?? "1");
  if (!Number.isInteger(season) || season < 1) return NextResponse.json({ error: "Season tidak valid." }, { status: 400 });
  try { return NextResponse.json({ ruleset: await getRuleset(season) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat ruleset." }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    const ruleset = await saveRuleset(body?.ruleset, admin.id);
    return NextResponse.json({ success: true, ruleset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan ruleset." }, { status: 400 });
  }
}
