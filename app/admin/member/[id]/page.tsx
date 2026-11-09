import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";
import { ArrowLeft, Flag, ShieldCheck, UserRound } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  const { id } = await params;
  const db = await getDatabase();
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(id)) notFound();
  const doc = await db.collection("admin_sheet_records").findOne({ _id: new ObjectId(id), sheet_key: "daftar-anggota" });
  if (!doc) notFound();
  const row = doc.row_data ?? {};
  const avatar = String(row.c15 ?? "");
  const displayName = String(row.c1 ?? "Member");
  return <main className="admin-shell"><section className="admin-main" style={{ marginLeft: 0, width: "100%" }}>
    <header className="admin-topbar"><Link href="/admin/daftar-anggota" className="sheet-back"><ArrowLeft size={15}/> Kembali ke Daftar Anggota</Link><span className="admin-secure"><i/> ADMIN SESSION</span></header>
    <div className="admin-content">
      <section className="sheet-heading"><div><div className="admin-eyebrow">CALERIS MASTERS / MEMBER PROFILE</div><h1>{displayName.toUpperCase()}</h1><p>Detail profil dan status keanggotaan.</p></div><div className="sheet-heading-icon"><UserRound size={24}/></div></section>
      <section className="sheet-panel" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 112, height: 112, borderRadius: 18, overflow: "hidden", background: "#17191e", border: "1px solid #393b42", display: "grid", placeItems: "center" }}>
            {avatar.startsWith("data:image/") || avatar.startsWith("https://") ? <img src={avatar} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <UserRound size={42}/>}
          </div>
          <div><span className="admin-eyebrow">{String(row.c3 ?? row.c10 ?? "Member")}</span><h2 style={{ margin: "8px 0" }}>{displayName}</h2><p>{String(row.c2 ?? "Belum terikat tim")} · {String(row.c6 ?? "Kategori belum ditentukan")}</p><span className="sheet-access"><ShieldCheck size={13}/> {String(row.c4 ?? "Status tidak tersedia")}</span></div>
        </div>
        <div className="admin-overview-strip" style={{ marginTop: 24 }}>
          <div><span className="overview-label">MEMBER ID</span><b>{String(row.c17 ?? "—")}</b></div>
          <div><span className="overview-label">LISENSI</span><b>{String(row.c11 || "—")}</b></div>
          <div><span className="overview-label">KONTRAK</span><b>{String(row.c9 || "—")}</b></div>
        </div>
        <div className="sheet-form-grid" style={{ marginTop: 24 }}>
          {Object.entries({ "Nama":row.c1, "Tim saat ini":row.c2, "Role":row.c3, "Status":row.c4, "Tim awal":row.c5, "Kategori":row.c6, "Gaji per season":row.c7, "Helper check-in":row.c8, "Durasi kontrak":row.c9, "Role awal":row.c10, "Lisensi":row.c11, "Season direkrut":row.c12, "Sisa kontrak":row.c13 }).map(([label,value])=><div className="sheet-field" key={label}><span>{label}</span><b>{String(value ?? "—") || "—"}</b></div>)}
        </div>
      </section>
    </div>
  </section></main>;
}
