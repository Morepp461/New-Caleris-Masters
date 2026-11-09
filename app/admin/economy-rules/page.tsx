"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, RefreshCw, Settings2 } from "lucide-react";

export default function EconomyRulesPage() {
  const [season,setSeason]=useState("1");
  const [json,setJson]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load(value=season) {
    setLoading(true); setError(""); setMessage("");
    try {
      const response=await fetch(`/api/admin/economy-rules?season=${encodeURIComponent(value)}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Gagal memuat ruleset.");
      setJson(JSON.stringify(data.ruleset,null,2));
    } catch(e) { setError(e instanceof Error?e.message:"Gagal memuat ruleset."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load("1");},[]);
  async function save() {
    setSaving(true);setError("");setMessage("");
    try {
      const ruleset=JSON.parse(json);
      const response=await fetch("/api/admin/economy-rules",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({ruleset})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Gagal menyimpan ruleset.");
      setJson(JSON.stringify(data.ruleset,null,2));
      setMessage(`Ruleset Season ${data.ruleset.season} berhasil disimpan.`);
    } catch(e) { setError(e instanceof Error?e.message:"JSON tidak valid."); }
    finally { setSaving(false); }
  }
  return <main className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand"><span className="admin-brand-mark">C<span>.</span></span><span><b>CALERIS</b><small>MASTERS CONTROL</small></span></Link><div className="admin-sidebar-label">WORKSPACE</div><Link href="/" className="admin-side-active"><span className="side-active-icon"><ArrowLeft size={17}/></span><span><b>Dashboard Admin</b><small>Kembali ke seluruh modul</small></span></Link></aside>
    <section className="admin-main"><header className="admin-topbar"><div className="admin-breadcrumb"><Link href="/">DASHBOARD ADMIN</Link><span>/</span><b>ECONOMY RULES</b></div><span className="admin-secure"><i/> ADMIN SESSION</span></header>
      <div className="admin-content"><div className="sheet-back-row"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Semua modul</Link><span className="sheet-access"><Settings2 size={13}/> SEASON RULESET</span></div>
        <section className="sheet-heading"><div><div className="admin-eyebrow">ECONOMY ENGINE / CONFIGURATION</div><h1>RULES MANAGER</h1><p>Semua parameter ekonomi disimpan per season. Perubahan ruleset tidak mengubah snapshot aturan pada transaksi yang sudah tercatat.</p></div><div className="sheet-heading-icon"><Settings2 size={24}/></div></section>
        <div className="sheet-toolbar"><div><span className="admin-eyebrow">VERSIONED CONFIGURATION</span><h2>Aturan Season</h2></div><div className="sheet-actions"><input className="sheet-season-input" type="number" min="1" value={season} onChange={e=>setSeason(e.target.value)} aria-label="Season"/><button className="sheet-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/></button><button className="sheet-add" onClick={()=>void load()} disabled={loading}>Muat Ruleset</button></div></div>
        <div className="sheet-helper"><span>i</span>Editor ini memberi akses ke seluruh field ruleset: tarif, gaji, pajak, denda, development, pinjaman, sponsorship, prize money, bantuan tim, registrasi, role upgrade, dan workflow. Nilai persentase ditulis desimal, misalnya 0.1 = 10%.</div>
        {error&&<div className="sheet-error">{error}</div>}{message&&<div className="sheet-helper">{message}</div>}
        <textarea className="rules-json-editor" spellCheck={false} value={json} onChange={e=>setJson(e.target.value)} placeholder={loading?"Memuat ruleset...":"Ruleset JSON"} />
        <div className="sheet-modal-footer"><button className="sheet-save" onClick={()=>void save()} disabled={saving||loading}><Save size={15}/>{saving?"Menyimpan...":"Simpan Ruleset Season"}</button></div>
        <footer className="admin-footer"><span>© 2026 CALERIS MASTERS</span><span>RULESET CONFIGURATION · ADMIN ONLY</span></footer>
      </div>
    </section>
  </main>;
}
