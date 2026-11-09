import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { postLedgerEntry, getAccountBalance } from "@/lib/transaction-engine";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accountName = request.nextUrl.searchParams.get("account");
  const seasonValue = request.nextUrl.searchParams.get("season");
  if (!accountName) return NextResponse.json({ error: "Parameter account wajib diisi." }, { status: 400 });
  try {
    const balance = await getAccountBalance(accountName, seasonValue ? Number(seasonValue) : undefined);
    return NextResponse.json({ account: accountName, balance });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghitung saldo." }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  try {
    const result = await postLedgerEntry({
      accountName: String(body.accountName ?? ""),
      direction: body.direction,
      category: String(body.category ?? ""),
      description: body.description ? String(body.description) : "",
      amount: body.amount === undefined || body.amount === "" ? undefined : Number(body.amount),
      points: body.points === undefined || body.points === "" ? undefined : Number(body.points),
      period: Number(body.period),
      season: Number(body.season),
      date: body.date ? String(body.date) : undefined,
    }, admin.id);
    return NextResponse.json({ success: true, transaction: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transaksi gagal diproses." }, { status: 400 });
  }
}
