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
    const roster = backup.members.filter((member: any) => member.tim === team.nama);
    const owner = roster.find((member: any) => member.role === "Owner");
    const principal = roster.find((member: any) => member.role === "Principal");
    const drivers = roster.filter((member: any) => member.role === "Driver").map((member: any) => member.nama);
    await memberCollection.updateOne(
      { sheet_key: "data-tim", source_id: String(team.id) },
      { $set: {
        sheet_key: "data-tim", source_id: String(team.id),
        row_data: { c0: team.nama, c1: team.teamId ?? "", c2: team.kategori ?? "", c3: team.engine ?? "", c4: team.tanggalRegistrasi ?? "", c5: team.status ?? "", c6: owner?.nama ?? "", c7: principal?.nama ?? "", c8: drivers.join(", "), c9: String(roster.length), c10: String(team.poin ?? 0), c11: team.parentTeam ?? "", c12: [team.asalKota, team.asalNegara].filter(Boolean).join(", "), c13: team.hakVetoPermanen ? "Ya" : "Tidak" },
        updated_at: new Date(), assets_imported_at: new Date()
      }, $setOnInsert: { created_at: new Date(), created_by: admin.id }, $set: { updated_by: admin.id } },
      { upsert: true }
    );
    if (typeof team.logo === "string" && team.logo.startsWith("data:image/")) teamAssets++;
  }
  await db.collection("audit_logs").insertOne({ action: "backup.assets.imported", actor_id: admin.id, metadata: { memberAssets, teamAssets, members: backup.members.length, teams: backup.teams.length }, created_at: new Date() });
  return NextResponse.json({ success: true, memberAssets, teamAssets, membersProcessed: backup.members.length, teamsProcessed: backup.teams.length });
}
