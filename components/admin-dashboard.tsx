"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Search, ShieldCheck, LogOut, type LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { ADMIN_SHEETS, type AdminSheet } from "@/lib/admin-sheets";
import { SignOutButton } from "@/components/sign-out-button";

const iconFor=(name:string):LucideIcon=>{
 const icons=Icons as unknown as Record<string,LucideIcon>;
 const key=name.split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join("");
 return icons[key]??Activity;
};
const groups=["GENERAL","MASTER DATA","ECONOMY","COMPETITION","REPORTS","HISTORY","SETTINGS"];
const groupLabel:Record<string,string>={GENERAL:"Overview & Operasional","MASTER DATA":"Master Data","ECONOMY":"Ekonomi & Keuangan",COMPETITION:"Kompetisi",REPORTS:"Laporan & Analitik",HISTORY:"Arsip & Riwayat",SETTINGS:"Konfigurasi"};

export function AdminDashboard({counts={},displayName="Administrator"}:{counts?:Record<string,number>;displayName?:string}) {
 const [query,setQuery]=useState("");
 const filtered=useMemo(()=>ADMIN_SHEETS.filter(s=>(s.name+" "+s.description+" "+groupLabel[s.group]).toLowerCase().includes(query.toLowerCase())),[query]);
 const activeCount=Object.values(counts).reduce((a,b)=>a+b,0);
 return <main className="admin-shell">
  <aside className="admin-sidebar">
   <Link href="/" className="admin-brand"><span className="admin-brand-mark">C<span>.</span></span><span><b>CALERIS</b><small>MASTERS CONTROL</small></span></Link>
   <div className="admin-sidebar-label">WORKSPACE</div>
   <div className="admin-side-active"><span className="side-active-icon"><ShieldCheck size={17}/></span><span><b>Dashboard Admin</b><small>Master control center</small></span></div>
   <div className="admin-sidebar-bottom"><div className="admin-user"><span className="admin-user-avatar">{displayName.slice(0,1).toUpperCase()}</span><span><b>{displayName}</b><small>System Administrator</small></span><SignOutButton/></div><div className="admin-version">CALERIS MASTERS · ADMIN</div></div>
  </aside>
  <section className="admin-main">
   <header className="admin-topbar"><div className="admin-mobile-brand">CALERIS <span>MASTERS</span></div><div className="admin-topbar-right"><span className="admin-secure"><i/> ADMIN SESSION</span><span className="admin-top-avatar">{displayName.slice(0,1).toUpperCase()}</span></div></header>
   <div className="admin-content">
    <section className="admin-hero"><div><div className="admin-eyebrow">CALERIS MASTERS / CONTROL CENTER</div><h1>DASHBOARD <em>ADMIN</em></h1><p>Seluruh workbook operasional dalam satu pusat kendali. Pilih sheet untuk membuka halaman pengelolaannya.</p></div><div className="admin-hero-mark">CM<span>01</span></div></section>
    <div className="admin-overview-strip"><div><span className="overview-label">WORKBOOK MODULES</span><b>{ADMIN_SHEETS.length.toString().padStart(2,"0")}</b><small>Halaman sheet terdaftar</small></div><div><span className="overview-label">ADMIN RECORDS</span><b>{activeCount.toLocaleString("id-ID")}</b><small>Baris data pada workspace</small></div><div><span className="overview-label">ACCESS LEVEL</span><b>ADMIN</b><small>Restricted workspace</small></div></div>
    <div className="admin-section-heading"><div><span className="admin-eyebrow">WORKBOOK STRUCTURE</span><h2>Modul Administrasi</h2><p>Satu sheet, satu halaman. Semua halaman di bawah ini hanya dapat dibuka Admin.</p></div><label className="admin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari modul..."/></label></div>
    {groups.map(group=>{const items=filtered.filter(s=>s.group===group);if(!items.length)return null;return <section className="admin-module-group" key={group}><div className="admin-group-title"><span>{groupLabel[group]}</span><i/></div><div className="admin-card-grid">{items.map((sheet:AdminSheet)=>{const Icon=iconFor(sheet.icon);return <Link href={`/admin/${sheet.slug}`} className="admin-module-card" key={sheet.key}><span className="admin-module-icon"><Icon size={19}/></span><span className="admin-module-copy"><b>{sheet.name}</b><small>{sheet.description}</small></span><span className="admin-module-meta"><b>{counts[sheet.key]??0}</b><small>records</small></span><ArrowUpRight className="admin-card-arrow" size={16}/></Link>})}</div></section>})}
    {filtered.length===0&&<div className="admin-no-results">Tidak ada modul yang cocok dengan pencarian.</div>}
    <footer className="admin-footer"><span>© 2026 CALERIS MASTERS</span><span><ShieldCheck size={13}/> PRIVATE ADMIN WORKSPACE</span></footer>
   </div>
  </section>
 </main>;
}
