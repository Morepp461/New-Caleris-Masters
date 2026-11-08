"use client";
import {useState} from "react";
import {Activity,ArrowUpRight,Banknote,Bell,ChevronDown,CircleHelp,Flag,LayoutDashboard,Menu,Plus,Search,Settings2,ShieldCheck,Trophy,Users,Wallet,X} from "lucide-react";
import {DEFAULT_STATE,formatCurrency} from "@/lib/economy";

type DashboardStats = { members:number; teams:number; circulatingBalance:number; racesCompleted:number; balancingPeriod:number; season:number; bankBalance:number };
const defaultStats:DashboardStats = DEFAULT_STATE;

const nav=[{label:"Overview",icon:LayoutDashboard},{label:"Anggota",icon:Users},{label:"Tim",icon:Flag},{label:"Keuangan",icon:Wallet},{label:"Balapan",icon:Trophy},{label:"Vreeo Bank",icon:Banknote}];
const metrics=[
 {label:"Total Anggota",value:String(DEFAULT_STATE.members),note:"Belum ada anggota",icon:Users},
 {label:"Total Tim",value:String(DEFAULT_STATE.teams),note:"Belum ada tim terdaftar",icon:Flag},
 {label:"¢p Beredar",value:formatCurrency(DEFAULT_STATE.circulatingBalance),note:"Saldo seluruh anggota",icon:Wallet},
 {label:"Race Berjalan",value:String(DEFAULT_STATE.racesCompleted),note:"Season belum dimulai",icon:Trophy}
];
const descriptions:Record<string,string>={Overview:"Ringkasan operasional dan ekonomi kompetisi.",Anggota:"Direktori driver, principal, agent, journalist, dan FIA.",Tim:"Manajemen tim, principal, divisi, dan saldo tim.",Keuangan:"Transaksi, saldo anggota, pajak, denda, dan sponsorship.",Balapan:"Kalender race, hasil, dan periode balancing.","Vreeo Bank":"Pinjaman tim, jatuh tempo, dan bunga keterlambatan."};

export function Dashboard(){
 const [active,setActive]=useState("Overview");
 const [menuOpen,setMenuOpen]=useState(false);
 const [search,setSearch]=useState("");
 return <main className="app-frame">
  <aside className={`sidebar ${menuOpen?"sidebar-open":""}`}>
   <div className="brand"><div className="brand-mark">C<span>.</span></div><div><div className="brand-name">CALERIS</div><div className="brand-sub">MASTERS CONTROL</div></div><button className="icon-button close-menu" onClick={()=>setMenuOpen(false)} aria-label="Tutup menu"><X size={18}/></button></div>
   <div className="workspace-label">WORKSPACE</div><div className="season-switch"><div className="season-icon">S<span>0</span></div><div className="season-copy"><b>Season {stats.season}</b><small>{stats.season===0?"Belum dimulai":"Sedang berjalan"}</small></div><ChevronDown size={15}/></div>
   <nav className="nav-list" aria-label="Navigasi utama"><div className="nav-caption">MANAGEMENT</div>
    {nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{setActive(label);setMenuOpen(false)}} className={`nav-item ${active===label?"active":""}`}><Icon size={17}/><span>{label}</span>{active===label&&<span className="nav-active-dot"/>}</button>)}
    <div className="nav-caption nav-caption-spaced">SYSTEM</div><button className="nav-item" onClick={()=>setActive("Pengaturan")}><Settings2 size={17}/><span>Pengaturan</span></button><button className="nav-item" onClick={()=>setActive("Panduan")}><CircleHelp size={17}/><span>Panduan sistem</span></button>
   </nav>
   <div className="sidebar-bottom"><div className="admin-card"><div className="admin-avatar">A</div><div className="admin-copy"><b>Administrator</b><small>Caleris Masters</small></div><ChevronDown size={14}/></div><div className="sidebar-version">CALERIS MASTERS <span>·</span> FOUNDATION</div></div>
  </aside>
  <section className="main-column">
   <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Buka menu"><Menu size={19}/></button><div className="breadcrumb">CALERIS MASTERS <span>/</span> <b>{active.toUpperCase()}</b></div></div>
    <div className="topbar-actions"><label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari apa saja..."/><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={17}/><i/></button><div className="topbar-divider"/><div className="top-admin"><div className="top-admin-avatar">A</div><div><b>Admin</b><small>Super Admin</small></div></div></div>
   </header>
   <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">OFFICIAL MANAGEMENT PLATFORM</div><h1>{active==="Overview"?"COMMAND CENTER":active.toUpperCase()}</h1><p>{descriptions[active]??"Konfigurasi dan informasi platform Caleris Masters."}</p></div><div className="heading-actions"><span className="live-status"><i/> SYSTEM READY</span><button className="primary-button" onClick={()=>setActive("Anggota")}><Plus size={16}/> Tambah Anggota</button></div></div>
    {active==="Overview"?<>
     <div className="metrics-grid">{metrics.map(({label,value,note,icon:Icon},i)=><article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon metric-icon-${i}`}><Icon size={17}/></div></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</div>
     <div className="section-grid">
      <section className="panel balance-panel"><div className="panel-heading"><div><div className="panel-kicker">FINANCIAL OVERVIEW</div><h2>Perputaran Ekonomi</h2></div><span className="period-pill">{seasonLabel}</span></div><div className="balance-total">{formatCurrency(stats.circulatingBalance)}</div><div className="balance-caption">TOTAL SALDO BEREDAR</div>
       <div className="balance-chart"><div className="chart-grid"><span>¢p100k</span><span>¢p75k</span><span>¢p50k</span><span>¢p25k</span><span>¢p0</span></div><div className="chart-empty"><div className="chart-empty-icon"><Activity size={22}/></div><b>Belum ada aktivitas ekonomi</b><span>Grafik akan terbentuk setelah transaksi pertama dicatat.</span></div><div className="chart-months">{["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"].map(x=><span key={x}>{x}</span>)}</div></div>
       <div className="balance-legend"><span><i className="legend-income"/> Saldo masuk</span><span><i className="legend-expense"/> Saldo keluar</span></div>
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">LATEST UPDATES</div><h2>Aktivitas Terbaru</h2></div><button className="text-button">Lihat semua <ArrowUpRight size={13}/></button></div><div className="activity-empty"><div className="empty-icon"><Activity size={20}/></div><b>Belum ada aktivitas</b><span>Aktivitas sistem akan muncul di sini.</span></div></section>
     </div>
     <section className="panel lower-panel"><div className="panel-heading"><div><div className="panel-kicker">COMPETITION STATUS</div><h2>Status Kompetisi</h2></div><span className="period-pill">BELUM AKTIF</span></div><div className="status-grid"><div className="status-item"><span>Season aktif</span><b>{stats.season}</b><small>{stats.season===0?"Belum ada season":"Season terdaftar"}</small></div><div className="status-item"><span>Periode balancing</span><b>{stats.balancingPeriod}</b><small>Setiap 5 race</small></div><div className="status-item"><span>Race berikutnya</span><b>{stats.season===0?"—":stats.racesCompleted+1}</b><small>{stats.season===0?"Jadwal belum tersedia":"Nomor race selanjutnya"}</small></div><div className="status-item"><span>Vreeo Bank</span><b>{formatCurrency(stats.bankBalance)}</b><small>Saldo kas bank</small></div></div></section>
    </>:<section className="panel module-placeholder"><div className="empty-icon"><ShieldCheck size={22}/></div><div className="panel-kicker">MODULE FOUNDATION</div><h2>{active}</h2><p>Struktur modul sudah disiapkan. Fitur operasional akan diaktifkan setelah skema database dan hak akses dipasang.</p><span className="period-pill">BELUM TERHUBUNG KE DATABASE</span></section>}
    <footer className="page-footer"><span>© 2026 CALERIS MASTERS</span><span>BUILT FOR THE PADDOCK <b>◆</b></span></footer>
   </div>
  </section>
 </main>;
}
