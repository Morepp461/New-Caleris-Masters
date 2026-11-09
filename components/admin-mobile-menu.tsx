"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight, LayoutDashboard, Settings2, Workflow, ImagePlus } from "lucide-react";
import { ADMIN_SHEETS } from "@/lib/admin-sheets";

const groups=["GENERAL","MASTER DATA","ECONOMY","COMPETITION","REPORTS","HISTORY","SETTINGS"];
const titles:Record<string,string>={GENERAL:"Overview & Operasional","MASTER DATA":"Master Data","ECONOMY":"Ekonomi & Keuangan",COMPETITION:"Kompetisi",REPORTS:"Laporan & Analitik",HISTORY:"Arsip & Riwayat",SETTINGS:"Konfigurasi"};

export function AdminMobileMenu(){
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" className="admin-mobile-menu" aria-label="Buka navigasi" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={20}/></button>
  {open&&<div className="admin-mobile-overlay" role="presentation" onClick={()=>setOpen(false)}>
   <button type="button" className="admin-mobile-scrim" aria-label="Tutup navigasi"/>
   <aside className="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigasi Caleris Masters" onClick={e=>e.stopPropagation()}>
    <div className="admin-mobile-drawer-head"><div><b>CALERIS MASTERS</b><small>ADMIN CONTROL CENTER</small></div><button type="button" aria-label="Tutup menu" onClick={()=>setOpen(false)}><X size={18}/></button></div>
    <nav>
     <Link href="/" onClick={()=>setOpen(false)}><span><b>Dashboard Admin</b><small>Ringkasan dan seluruh modul</small></span><LayoutDashboard size={16}/></Link>
     {groups.map(group=>{const sheets=ADMIN_SHEETS.filter(sheet=>sheet.group===group);if(!sheets.length)return null;return <section key={group}><div className="admin-mobile-group">{titles[group]}</div>{sheets.map(sheet=><Link href={`/admin/${sheet.slug}`} key={sheet.key} onClick={()=>setOpen(false)}><span><b>{sheet.name}</b><small>{sheet.description}</small></span><ArrowUpRight size={14}/></Link>)}</section>})}
     <section><div className="admin-mobile-group">Tools Admin</div><Link href="/admin/economy-workflows" onClick={()=>setOpen(false)}><span><b>Economy Workflows</b><small>Jalankan proses transaksi</small></span><Workflow size={15}/></Link><Link href="/admin/economy-rules" onClick={()=>setOpen(false)}><span><b>Economy Rules</b><small>Konfigurasi aturan ekonomi</small></span><Settings2 size={15}/></Link><Link href="/admin/import-assets" onClick={()=>setOpen(false)}><span><b>Import Avatar & Logo</b><small>Impor aset profil dari backup</small></span><ImagePlus size={15}/></Link></section>
    </nav>
    <Link href="/" className="admin-mobile-home" onClick={()=>setOpen(false)}>Kembali ke Dashboard</Link>
   </aside>
  </div>}
 </>;
}
