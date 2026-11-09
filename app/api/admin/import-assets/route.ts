import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("backup");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pilih file backup JSON." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Ukuran backup maksimal 12 MB." }, { status: 413 });
  let backup: any;
  try { backup = JSON.parse(await file.text()); } catch { return NextResponse.json({ error: "File JSON tidak valid." }, { status: 400 }); }
  if (!Array.isArray(backup.members) || !Array.isArray(backup.teams)) return NextResponse.json({ error: "Backup tidak memiliki data members dan teams." }, { status: 400 });
  const db = await getDatabase();
  const memberCollection = db.collection("admin_sheet_records");
  let memberAssets = 0;
  for (const member of backup.members) {
    if (!member?.memberId || typeof member.foto !== "string" || !member.foto.startsWith("data:image/")) continue;
    const result = await memberCollection.updateOne(
      { sheet_key: "daftar-anggota", "row_data.c17": String(member.memberId) },
      { $set: { "row_data.c15": member.foto, updated_at: new Date(), assets_imported_at: new Date() } }
    );
    memberAssets += result.modifiedCount;
  }
  const teamCollection = db.collection("team_profiles");
  let teamAssets = 0;
  for (const team of backup.teams) {
    if (!team?.nama) continue;
    await teamCollection.updateOne(
      { nama: String(team.nama) },
      { $set: { ...team, _assetUpdatedAt: new Date(), _assetUpdatedBy: admin.id } },
      { upsert: true }
    );
    if (typeof team.logo === "string" && team.logo.startsWith("data:image/")) teamAssets++;
  }
  await db.collection("audit_logs").insertOne({ action: "backup.assets.imported", actor_id: admin.id, metadata: { memberAssets, teamAssets, members: backup.members.length, teams: backup.teams.length }, created_at: new Date() });
  return NextResponse.json({ success: true, memberAssets, teamAssets, membersProcessed: backup.members.length, teamsProcessed: backup.teams.length });
}
