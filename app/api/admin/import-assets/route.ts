import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

type BackupMember = {
  memberId?: string; nama?: string; tim?: string; role?: string; foto?: string;
};
type BackupTeam = {
  id?: string; teamId?: string; nama?: string; kategori?: string; engine?: string;
  tanggalRegistrasi?: string; status?: string; hakVetoPermanen?: boolean;
  logo?: string; asalKota?: string; asalNegara?: string; poin?: number; parentTeam?: string;
};

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("backup");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pilih file backup JSON." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Ukuran backup maksimal 12 MB." }, { status: 413 });

  let backup: { members: BackupMember[]; teams: BackupTeam[] };
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.teams)) throw new Error("Backup tidak memiliki data members dan teams.");
    backup = parsed;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "File JSON tidak valid." }, { status: 400 });
  }

  const db = await getDatabase();
  const records = db.collection("admin_sheet_records");
  let memberAssets = 0;
  for (const member of backup.members) {
    if (!member.memberId || typeof member.foto !== "string" || !member.foto.startsWith("data:image/")) continue;
    const result = await records.updateOne(
      { sheet_key: "daftar-anggota", "row_data.c17": String(member.memberId) },
      { $set: { "row_data.c15": member.foto, updated_at: new Date(), assets_imported_at: new Date(), updated_by: admin.id } }
    );
    memberAssets += result.modifiedCount;
  }

  let teamAssets = 0;
  for (const team of backup.teams) {
    if (!team.nama) continue;
    await db.collection("team_profiles").updateOne(
      { nama: team.nama },
      { $set: { ...team, _assetUpdatedAt: new Date(), _assetUpdatedBy: admin.id } },
      { upsert: true }
    );
    const roster = backup.members.filter(member => member.tim === team.nama);
    const owner = roster.find(member => member.role === "Owner");
    const principal = roster.find(member => member.role === "Principal");
    const drivers = roster.filter(member => member.role === "Driver").map(member => member.nama).filter(Boolean);
    await records.updateOne(
      { sheet_key: "data-tim", source_id: String(team.id ?? team.nama) },
      {
        $set: {
          sheet_key: "data-tim",
          source_id: String(team.id ?? team.nama),
          row_data: {
            c0: team.nama, c1: team.teamId ?? "", c2: team.kategori ?? "",
            c3: team.engine ?? "", c4: team.tanggalRegistrasi ?? "",
            c5: team.status ?? "", c6: owner?.nama ?? "",
            c7: principal?.nama ?? "", c8: drivers.join(", "),
            c9: String(roster.length), c10: String(team.poin ?? 0),
            c11: team.parentTeam ?? "",
            c12: [team.asalKota, team.asalNegara].filter(Boolean).join(", "),
            c13: team.hakVetoPermanen ? "Ya" : "Tidak"
          },
          updated_at: new Date(),
          assets_imported_at: new Date(),
          updated_by: admin.id
        },
        $setOnInsert: { created_at: new Date(), created_by: admin.id }
      },
      { upsert: true }
    );
    if (typeof team.logo === "string" && team.logo.startsWith("data:image/")) teamAssets++;
  }

  await db.collection("audit_logs").insertOne({
    action: "backup.assets.imported", actor_id: admin.id,
    metadata: { memberAssets, teamAssets, members: backup.members.length, teams: backup.teams.length },
    created_at: new Date()
  });
  return NextResponse.json({
    success: true, memberAssets, teamAssets,
    membersProcessed: backup.members.length, teamsProcessed: backup.teams.length
  });
}
