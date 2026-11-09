import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";
import { ArrowLeft, Flag, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function TeamDetail({ params }: { params: Promise<{ name: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  const { name } = await params;
  const teamName = decodeURIComponent(name);
  const db = await getDatabase();
  const team = await db.collection("team_profiles").findOne({ nama: teamName });
  const members = await db.collection("admin_sheet_records").find({ sheet_key: "daftar-anggota", "row_data.c2": teamName }).sort({ "row_data.c3": 1 }).toArray();
  if (!team && !members.length) notFound();
  const logo = String(team?.logo ?? "");
  const owner = members.find(x => String(x.row_data?.c3) === "Owner");
  const drivers = members.filter(x => String(x.row_data?.c3) === "Driver");
  return <main className="admin-shell"><section className="admin-main" style={{ marginLeft: 0, width: "100%" }}>
    <header className="admin-topbar"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Dashboard Admin</Link><span className="admin-secure"><i/> ADMIN SESSION</span></header>
    <div className="admin-content">
      <section className="sheet-heading"><div><div className="admin-eyebrow">CALERIS MASTERS / TEAM PROFILE</div><h1>{teamName.toUpperCase()}</h1><p>Detail tim, susunan anggota, dan informasi kompetisi.</p></div><div className="sheet-heading-icon"><Flag size={24}/></div></section>
      <section className="sheet-panel" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 112, height: 112, borderRadius: 18, overflow: "hidden", background: "#17191e", border: "1px solid #393b42", display: "grid", placeItems: "center" }}>{logo.startsWith("data:image/") || logo.startsWith("https://") ? <img src={logo} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "contain" }}/> : <Flag size={42}/>}</div>
          <div><span className="admin-eyebrow">{String(team?.kategori ?? "Tim")}</span><h2 style={{ margin: "8px 0" }}>{teamName}</h2><p>{String(team?.engine || "Engine belum tercatat")} · {String(team?.asalKota || "Lokasi belum tersedia")}{team?.asalNegara ? ", "+team.asalNegara : ""}</p><span className="sheet-access"><ShieldCheck size={13}/> {String(team?.status ?? "Data tim tersedia")}</span></div>
        </div>
        <div className="admin-overview-strip" style={{ marginTop: 24 }}>
          <div><span className="overview-label">TEAM ID</span><b>{String(team?.teamId ?? "—")}</b></div>
          <div><span className="overview-label">OWNER</span><b>{String(owner?.row_data?.c1 ?? "—")}</b></div>
          <div><span className="overview-label">DRIVER</span><b>{drivers.length}</b></div>
        </div>
        <h2 style={{ margin: "26px 0 12px" }}>Anggota Tim</h2>
        <div className="sheet-table-wrap"><table className="sheet-table"><thead><tr><th>Nama</th><th>Role</th><th>Kategori</th><th>Status</th></tr></thead><tbody>{members.map(member=><tr key={String(member._id)}><td><Link href={`/admin/member/${String(member._id)}`}>{String(member.row_data?.c1 ?? "Member")}</Link></td><td>{String(member.row_data?.c3 ?? "—")}</td><td>{String(member.row_data?.c6 ?? "—")}</td><td>{String(member.row_data?.c4 ?? "—")}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  </section></main>;
}
