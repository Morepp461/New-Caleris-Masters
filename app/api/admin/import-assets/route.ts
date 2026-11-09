import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

type BackupMember = { memberId?: string; nama?: string; tim?: string; role?: string; foto?: string };
type BackupTeam = {
  id?: string; teamId?: string; nama?: string; kategori?: string; engine?: string;
  tanggalRegistrasi?: string; status?: string; hakVetoPermanen?: boolean | string;
  logo?: string; asalKota?: string; asalNegara?: string; poin?: number | string; parentTeam?: string;
};

const isImageData = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Upload tidak terbaca. Coba pilih ulang file JSON." }, { status: 400 }); }

  const file = form.get("backup");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pilih file backup JSON terlebih dahulu." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Ukuran backup maksimal 12 MB." }, { status: 413 });
  if (!file.name.toLowerCase().endsWith(".json")) return NextResponse.json({ error: "Format file harus JSON." }, { status: 415 });

  let members: BackupMember[];
  let teams: BackupTeam[];
  try {
    const parsed = JSON.parse(await file.text()) as { members?: unknown; teams?: unknown };
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.teams)) {
      return NextResponse.json({ error: "Struktur backup tidak sesuai. Data members dan teams tidak ditemukan." }, { status: 400 });
    }
    members = parsed.members as BackupMember[];
    teams = parsed.teams as BackupTeam[];
  } catch {
    return NextResponse.json({ error: "File JSON rusak atau tidak valid." }, { status: 400 });
  }

  const db = await getDatabase();
  const records = db.collection("admin_sheet_records");
  const now = new Date();
  let memberAssets = 0;
  let memberRowsMatched = 0;
  let memberAssetsSkipped = 0;

  for (const member of members) {
    if (!isImageData(member.foto)) { memberAssetsSkipped++; continue; }
    const identityFilter = member.memberId
      ? { $or: [{ "row_data.c17": String(member.memberId) }, ...(member.nama ? [{ "row_data.c1": member.nama }] : [])] }
      : { "row_data.c1": member.nama ?? "" };
    const existing = await records.findOne({ sheet_key: "daftar-anggota", ...identityFilter });
    if (!existing) { memberAssetsSkipped++; continue; }
    memberRowsMatched++;
    const result = await records.updateOne(
      { _id: existing._id, sheet_key: "daftar-anggota" },
      { $set: { "row_data.c15": member.foto, updated_at: now, assets_imported_at: now, updated_by: admin.id } }
    );
    if (result.modifiedCount) memberAssets++;
  }

  let teamAssets = 0;
  let teamProfilesProcessed = 0;
  for (const team of teams) {
    if (!team.nama) continue;
    const profile: Record<string, unknown> = {
      id: team.id ?? "", teamId: team.teamId ?? "", nama: team.nama,
      kategori: team.kategori ?? "", engine: team.engine ?? "",
      tanggalRegistrasi: team.tanggalRegistrasi ?? "", status: team.status ?? "",
      hakVetoPermanen: team.hakVetoPermanen === true || team.hakVetoPermanen === "True" || team.hakVetoPermanen === "Ya",
      asalKota: team.asalKota ?? "", asalNegara: team.asalNegara ?? "",
      poin: Number(team.poin ?? 0), parentTeam: team.parentTeam ?? "",
      _assetUpdatedAt: now, _assetUpdatedBy: admin.id
    };
    if (isImageData(team.logo)) profile.logo = team.logo;
    await db.collection("team_profiles").updateOne({ nama: team.nama }, { $set: profile }, { upsert: true });
    teamProfilesProcessed++;
    if (isImageData(team.logo)) teamAssets++;

    const roster = members.filter(member => member.tim === team.nama);
    const owner = roster.find(member => member.role === "Owner");
    const principal = roster.find(member => member.role === "Principal");
    const drivers = roster.filter(member => member.role === "Driver").map(member => member.nama).filter(Boolean);
    await records.updateOne(
      { sheet_key: "data-tim", source_id: String(team.id ?? team.nama) },
      {
        $set: {
          sheet_key: "data-tim", source_id: String(team.id ?? team.nama),
          row_data: {
            c0: team.nama, c1: team.teamId ?? "", c2: team.kategori ?? "",
            c3: team.engine ?? "", c4: team.tanggalRegistrasi ?? "",
            c5: team.status ?? "", c6: owner?.nama ?? "",
            c7: principal?.nama ?? "", c8: drivers.join(", "),
            c9: String(roster.length), c10: String(team.poin ?? 0),
            c11: team.parentTeam ?? "",
            c12: [team.asalKota, team.asalNegara].filter(Boolean).join(", "),
            c13: profile.hakVetoPermanen ? "Ya" : "Tidak"
          },
          updated_at: now, assets_imported_at: now, updated_by: admin.id
        },
        $setOnInsert: { created_at: now, created_by: admin.id }
      },
      { upsert: true }
    );
  }

  await db.collection("audit_logs").insertOne({
    action: "backup.assets.imported", actor_id: admin.id,
    metadata: {
      memberAssets, memberRowsMatched, memberAssetsSkipped,
      teamAssets, teamProfilesProcessed, members: members.length, teams: teams.length
    },
    created_at: now
  });

  return NextResponse.json({
    success: true, memberAssets, memberRowsMatched, memberAssetsSkipped,
    teamAssets, teamProfilesProcessed, membersProcessed: members.length, teamsProcessed: teams.length
  });
}
