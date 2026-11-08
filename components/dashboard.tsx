"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Banknote, Bell, ChevronDown, CircleHelp, Flag,
  LayoutDashboard, Menu, Plus, Search, Settings2, ShieldCheck, Trophy,
  Users, Wallet, X
} from "lucide-react";
import { DEFAULT_STATE, formatCurrency } from "@/lib/economy";

type DashboardStats = {
  members:number; teams:number; circulatingBalance:number; racesCompleted:number;
  balancingPeriod:number; season:number; bankBalance:number;
};
type MemberItem = {
  member_id:string|null; display_name:string|null; role:string|null; status:string|null;
  division:string|null; current_team_id:string|null; ending_balance:number|null; salary_per_race:number|null;
  team_name?:string;
};
type TeamItem = {team_id:string|null;team_name:string|null;principal_name:string|null;team_balance:number|null;active_bank_debt:number|null};
type TransactionItem = {id:string;transaction_date:string;member_id:string;direction:string;category:string;amount:number;description:string|null;member_name?:string};
type LoanItem = {id:string;team_id:string;principal_amount:number;borrowed_at:string;due_at:string;status:string;repayment_amount:number;team_name?:string};

const defaultStats:DashboardStats={...DEFAULT_STATE,bankBalance:0};
const nav=[
 {label:"Overview",icon:LayoutDashboard},{label:"Anggota",icon:Users},{label:"Tim",icon:Flag},
 {label:"Keuangan",icon:Wallet},{label:"Balapan",icon:Trophy},{label:"Vreeo Bank",icon:Banknote}
];
const descriptions:Record<string,string>={
 Overview:"Ringkasan operasional dan ekonomi kompetisi.",
 Anggota:"Direktori driver, principal, agent, journalist, dan FIA.",
 Tim:"Manajemen tim, principal, divisi, dan saldo tim.",
 Keuangan:"Riwayat transaksi dan pergerakan saldo.",
 Balapan:"Status season, race, dan periode balancing.",
 "Vreeo Bank":"Pinjaman tim, jatuh tempo, dan bunga keterlambatan."
};

function EmptyState({title,description}:{title:string;description:string}) {
 return <div className="table-empty"><div className="empty-icon"><Activity size={20}/></div><b>{title}</b><span>{description}</span></div>;
}

export function Dashboard({
 stats=defaultStats,members=[],teams=[],transactions=[],loans=[]
}:{
 stats?:DashboardStats;members?:MemberItem[];teams?:TeamItem[];
 transactions?:TransactionItem[];loans?:LoanItem[];
}) {
 const [active,setActive]=useState("Overview");
 const [menuOpen,setMenuOpen]=useState(false);
 const [search,setSearch]=useState("");
 const filteredMembers=useMemo(()=>members.filter(m=>[m.display_name,m.role,m.division,m.team_name,m.status].join(" ").toLowerCase().includes(search.toLowerCase())),[members,search]);
 const filteredTeams=useMemo(()=>teams.filter(t=>[t.team_name,t.principal_name].join(" ").toLowerCase().includes(search.toLowerCase())),[teams,search]);
 const filteredTransactions=useMemo(()=>transactions.filter(t=>[t.member_name,t.category,t.direction,t.description].join(" ").toLowerCase().includes(search.toLowerCase())),[transactions,search]);
 const filteredLoans=useMemo(()=>loans.filter(l=>[l.team_name,l.status].join(" ").toLowerCase().includes(search.toLowerCase())),[loans,search]);
 const metrics=[
  {label:"Total Anggota",value:String(stats.members),note:stats.members===0?"Belum ada anggota":"Anggota terdaftar",icon:Users},
  {label:"Total Tim",value:String(stats.teams),note:stats.teams===0?"Belum ada tim terdaftar":"Tim terdaftar",icon:Flag},
  {label:"¢p Beredar",value:formatCurrency(stats.circulatingBalance),note:"Saldo seluruh anggota",icon:Wallet},
  {label:"Race Berjalan",value:String(stats.racesCompleted),note:stats.season===0?"Season belum dimulai":"Race pada season aktif",icon:Trophy}
 ];
 const seasonLabel=`SEASON ${stats.season}`;

 return <main className="app-frame">
  <aside className={`sidebar ${menuOpen?"sidebar-open":""}`}>
   <div className="brand"><div className="brand-mark">C<span>.</span></div><div><div className="brand-name">CALERIS</div><div className="brand-sub">MASTERS CONTROL</div></div><button className="icon-button close-menu" onClick={()=>setMenuOpen(false)} aria-label="Tutup menu"><X size={18}/></button></div>
   <div className="workspace-label">WORKSPACE</div><div className="season-switch"><div className="season-icon">S<span>{stats.season}</span></div><div className="season-copy"><b>Season {stats.season}</b><small>{stats.season===0?"Belum dimulai":"Sedang berjalan"}</small></div><ChevronDown size={15}/></div>
   <nav className="nav-list" aria-label="Navigasi utama"><div className="nav-caption">MANAGEMENT</div>
    {nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{setActive(label);setMenuOpen(false);setSearch("")}} className={`nav-item ${active===label?"active":""}`}><Icon size={17}/><span>{label}</span>{active===label&&<span className="nav-active-dot"/>}</button>)}
    <div className="nav-caption nav-caption-spaced">SYSTEM</div><button className={`nav-item ${active==="Pengaturan"?"active":""}`} onClick={()=>setActive("Pengaturan")}><Settings2 size={17}/><span>Pengaturan</span></button><button className={`nav-item ${active==="Panduan"?"active":""}`} onClick={()=>setActive("Panduan")}><CircleHelp size={17}/><span>Panduan sistem</span></button>
   </nav>
   <div className="sidebar-bottom"><div className="admin-card"><div className="admin-avatar">A</div><div className="admin-copy"><b>Administrator</b><small>Caleris Masters</small></div><ChevronDown size={14}/></div><div className="sidebar-version">CALERIS MASTERS <span>·</span> FOUNDATION</div></div>
  </aside>
  <section className="main-column">
   <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Buka menu"><Menu size={19}/></button><div className="breadcrumb">CALERIS MASTERS <span>/</span> <b>{active.toUpperCase()}</b></div></div>
    <div className="topbar-actions"><label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari apa saja..."/><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={17}/><i/></button><div className="topbar-divider"/><div className="top-admin"><div className="top-admin-avatar">A</div><div><b>Admin</b><small>Super Admin</small></div></div></div>
   </header>
   <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">OFFICIAL MANAGEMENT PLATFORM</div><h1>{active==="Overview"?"COMMAND CENTER":active.toUpperCase()}</h1><p>{descriptions[active]??"Konfigurasi dan informasi platform Caleris Masters."}</p></div><div className="heading-actions"><span className="live-status"><i/> SYSTEM READY</span>{active==="Overview"||active==="Anggota"?<button className="primary-button" onClick={()=>setActive("Anggota")}><Plus size={16}/> Tambah Anggota</button>:null}</div></div>
    {active==="Overview"?<>
     <div className="metrics-grid">{metrics.map(({label,value,note,icon:Icon},i)=><article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon metric-icon-${i}`}><Icon size={17}/></div></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</div>
     <div className="section-grid">
      <section className="panel balance-panel"><div className="panel-heading"><div><div className="panel-kicker">FINANCIAL OVERVIEW</div><h2>Perputaran Ekonomi</h2></div><span className="period-pill">{seasonLabel}</span></div><div className="balance-total">{formatCurrency(stats.circulatingBalance)}</div><div className="balance-caption">TOTAL SALDO BEREDAR</div>
       <div className="balance-chart"><div className="chart-grid"><span>¢p100k</span><span>¢p75k</span><span>¢p50k</span><span>¢p25k</span><span>¢p0</span></div><div className="chart-empty"><div className="chart-empty-icon"><Activity size={22}/></div><b>{stats.circulatingBalance===0?"Belum ada aktivitas ekonomi":"Ringkasan saldo berhasil dimuat"}</b><span>Grafik historis akan ditambahkan setelah pencatatan transaksi tersedia.</span></div><div className="chart-months">{["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"].map(x=><span key={x}>{x}</span>)}</div></div>
       <div className="balance-legend"><span><i className="legend-income"/> Saldo masuk</span><span><i className="legend-expense"/> Saldo keluar</span></div>
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">LATEST UPDATES</div><h2>Aktivitas Terbaru</h2></div><button className="text-button" onClick={()=>setActive("Keuangan")}>Lihat transaksi <ArrowUpRight size={13}/></button></div>{transactions.length===0?<EmptyState title="Belum ada aktivitas" description="Aktivitas sistem akan muncul setelah transaksi pertama dicatat."/>:<div className="recent-list">{transactions.slice(0,5).map(t=><div className="recent-row" key={t.id}><div><b>{t.category}</b><small>{t.member_name??"Anggota"} · {t.transaction_date}</small></div><strong className={t.direction==="income"?"income-text":"expense-text"}>{t.direction==="income"?"+":"−"}{formatCurrency(t.amount)}</strong></div>)}</div>}</section>
     </div>
     <section className="panel lower-panel"><div className="panel-heading"><div><div className="panel-kicker">COMPETITION STATUS</div><h2>Status Kompetisi</h2></div><span className="period-pill">{stats.season===0?"BELUM AKTIF":"ACTIVE SEASON"}</span></div><div className="status-grid"><div className="status-item"><span>Season aktif</span><b>{stats.season}</b><small>{stats.season===0?"Belum ada season":"Season terdaftar"}</small></div><div className="status-item"><span>Periode balancing</span><b>{stats.balancingPeriod}</b><small>Setiap 5 race</small></div><div className="status-item"><span>Race berikutnya</span><b>{stats.season===0?"—":stats.racesCompleted+1}</b><small>{stats.season===0?"Jadwal belum tersedia":"Nomor race selanjutnya"}</small></div><div className="status-item"><span>Vreeo Bank</span><b>{formatCurrency(stats.bankBalance)}</b><small>Saldo kas bank</small></div></div></section>
    </>:active==="Anggota"?<section className="panel data-panel"><div className="panel-heading"><div><div className="panel-kicker">MEMBER DIRECTORY</div><h2>Daftar Anggota <span className="count-label">{members.length}</span></h2></div><span className="period-pill">ALL ROLES</span></div>{filteredMembers.length===0?<EmptyState title="Belum ada anggota" description="Anggota baru akan tampil di sini setelah didaftarkan."/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Nama</th><th>Role</th><th>Divisi</th><th>Tim Saat Ini</th><th>Status</th><th className="align-right">Saldo</th></tr></thead><tbody>{filteredMembers.map(m=><tr key={m.member_id}><td className="primary-cell">{m.display_name??"—"}</td><td><span className="role-tag">{m.role??"—"}</span></td><td>{m.division??"—"}</td><td>{m.team_name??"Belum ada tim"}</td><td><span className={`status-tag ${m.status==="active"?"status-active":"status-inactive"}`}>{m.status==="active"?"Aktif":"Inactive"}</span></td><td className="align-right money-cell">{formatCurrency(m.ending_balance??0)}</td></tr>)}</tbody></table></div>}</section>
    :active==="Tim"?<section className="panel data-panel"><div className="panel-heading"><div><div className="panel-kicker">TEAM MANAGEMENT</div><h2>Daftar Tim <span className="count-label">{teams.length}</span></h2></div><span className="period-pill">PRINCIPAL BALANCE</span></div>{filteredTeams.length===0?<EmptyState title="Belum ada tim" description="Tim yang didaftarkan akan tampil di sini."/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Nama Tim</th><th>Principal</th><th className="align-right">Saldo Tim</th><th className="align-right">Hutang Bank</th></tr></thead><tbody>{filteredTeams.map(t=><tr key={t.team_id}><td className="primary-cell">{t.team_name??"—"}</td><td>{t.principal_name??"Belum ditentukan"}</td><td className="align-right money-cell">{formatCurrency(t.team_balance??0)}</td><td className="align-right money-cell">{formatCurrency(t.active_bank_debt??0)}</td></tr>)}</tbody></table></div>}</section>
    :active==="Keuangan"?<section className="panel data-panel"><div className="panel-heading"><div><div className="panel-kicker">FINANCIAL LEDGER</div><h2>Riwayat Transaksi <span className="count-label">{transactions.length}</span></h2></div><span className="period-pill">LATEST 100</span></div>{filteredTransactions.length===0?<EmptyState title="Belum ada transaksi" description="Semua pemasukan dan pengeluaran akan tercatat di ledger ini."/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Tanggal</th><th>Anggota</th><th>Kategori</th><th>Jenis</th><th className="align-right">Nominal</th></tr></thead><tbody>{filteredTransactions.map(t=><tr key={t.id}><td>{t.transaction_date}</td><td>{t.member_name??"—"}</td><td className="primary-cell">{t.category}</td><td><span className={t.direction==="income"?"income-text":"expense-text"}>{t.direction==="income"?"Masuk":"Keluar"}</span></td><td className="align-right money-cell">{t.direction==="income"?"+":"−"}{formatCurrency(t.amount)}</td></tr>)}</tbody></table></div>}</section>
    :active==="Vreeo Bank"?<section className="panel data-panel"><div className="panel-heading"><div><div className="panel-kicker">VREEO BANK</div><h2>Daftar Pinjaman <span className="count-label">{loans.length}</span></h2></div><span className="period-pill">SIMPLE INTEREST · 5% / DAY</span></div>{filteredLoans.length===0?<EmptyState title="Belum ada pinjaman" description="Pencairan dan pelunasan pinjaman akan tercatat di sini."/>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Tim</th><th>Tanggal Pinjam</th><th>Jatuh Tempo</th><th>Status</th><th className="align-right">Pokok</th><th className="align-right">Dibayar</th></tr></thead><tbody>{filteredLoans.map(l=><tr key={l.id}><td className="primary-cell">{l.team_name??"—"}</td><td>{l.borrowed_at}</td><td>{l.due_at}</td><td><span className={`status-tag ${l.status==="paid"?"status-active":"status-inactive"}`}>{l.status}</span></td><td className="align-right money-cell">{formatCurrency(l.principal_amount)}</td><td className="align-right money-cell">{formatCurrency(l.repayment_amount)}</td></tr>)}</tbody></table></div>}</section>
    :active==="Balapan"?<section className="panel module-placeholder"><div className="empty-icon"><Trophy size={22}/></div><div className="panel-kicker">SEASON CONTROL</div><h2>SEASON {stats.season}</h2><p>Race saat ini: {stats.racesCompleted}. Periode balancing: {stats.balancingPeriod}. Periode berikutnya berjalan setiap lima race.</p><span className="period-pill">{stats.season===0?"BELUM ADA SEASON AKTIF":"SEASON AKTIF"}</span></section>
    :<section className="panel module-placeholder"><div className="empty-icon"><ShieldCheck size={22}/></div><div className="panel-kicker">MODULE FOUNDATION</div><h2>{active}</h2><p>Modul ini akan dikembangkan setelah alur operasional inti selesai.</p><span className="period-pill">FOUNDATION</span></section>}
    <footer className="page-footer"><span>© 2026 CALERIS MASTERS</span><span>BUILT FOR THE PADDOCK <b>◆</b></span></footer>
   </div>
  </section>
 </main>;
}
