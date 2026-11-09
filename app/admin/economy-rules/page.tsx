"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, RefreshCw, Settings2, Plus, Trash2 } from "lucide-react";

type Value = string | number | boolean | Record<string, unknown>;
const labels: Record<string,string> = {
  season:"Season", name:"Nama Ruleset", status:"Status", currency:"Mata Uang",
  balancingEveryRaces:"Race per Periode Balancing", periodsPerSeason:"Periode per Season",
  bankOpeningBalance:"Saldo Awal Vreeo Bank", teamExpenseLimitRate:"Batas Pengeluaran Tim",
  transferTax:"Pajak Transfer", wealthTax:"Pajak Kekayaan", inactive:"Sanksi Inactive",
  loans:"Pinjaman Bank", development:"Development", sponsorship:"Sponsorship",
  teamAid:"Bantuan Tim", prizeMoney:"Prize Money", salary:"Gaji & Kontribusi",
  driverByLicense:"Rentang Gaji per Lisensi", principalMinimum:"Minimum Gaji Principal",
  ownerContribution:"Kontribusi Owner per Season", agentPerSeason:"Gaji Agent Legacy",
  journalistPerSeason:"Gaji Journalist Legacy", journalistViewBonus:"Bonus Konten Journalist",
  journalistViewThreshold:"Ambang Views Journalist", fiaPerSeason:"Gaji FIA per Season",
  enabled:"Aktifkan", threshold:"Ambang Nominal", individualThreshold:"Ambang Pajak Individu",
  teamThreshold:"Ambang Pajak Tim", rate:"Persentase", driverBalanceCutRate:"Potongan Saldo Driver",
  driverLicenseDeduction:"Pengurangan Poin Lisensi", teamFine:"Denda Inactive Tim",
  principalExemptionEnabled:"Pengecualian Principal Legacy", eligibilityBalanceBelow:"Batas Saldo Layak Pinjam",
  maxPerRequest:"Maksimal Pinjaman per Pengajuan", lateInterestPerPeriod:"Bunga per Periode Telat",
  driverCostPerPoint:"Biaya Development Driver per Poin", carCostPerPoint:"Biaya Development Mobil per Poin",
  minimumPoints:"Minimal Poin Development", raceWinnerFreePoints:"Poin Gratis Pemenang Race",
  participation:"T1 Partisipasi", zeroFines:"T2 Tanpa Denda", guaranteed:"T3 Sponsor Pasti",
  zeroDebt:"T4 Tanpa Hutang", balanceBelow:"Ambang Saldo Bantuan Tim", payout:"Nominal Bantuan",
  first:"Juara 1", second:"Juara 2", decrementPerPosition:"Pengurangan per Posisi",
  minimum:"Hadiah Minimum", tariffs:"Daftar Tarif", roleUpgradeFees:"Biaya Upgrade Role",
  teamRegistrationFees:"Biaya Registrasi Tim", enabledWorkflows:"Workflow yang Diizinkan",
  min:"Minimum", max:"Maksimum", draft:"Draft", active:"Aktif", closed:"Ditutup"
};
const pctKeys = new Set(["teamExpenseLimitRate","rate","driverBalanceCutRate","lateInterestPerPeriod"]);
const moneyKeys = new Set(["bankOpeningBalance","threshold","individualThreshold","teamThreshold","teamFine","eligibilityBalanceBelow","maxPerRequest","driverCostPerPoint","carCostPerPoint","participation","zeroFines","guaranteed","zeroDebt","balanceBelow","payout","first","second","decrementPerPosition","minimum","principalMinimum","ownerContribution","agentPerSeason","journalistPerSeason","journalistViewBonus","fiaPerSeason"]);
function label(key:string){return labels[key]??key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase());}
function updateAt(source:Record<string,unknown>, path:string[], value:unknown):Record<string,unknown>{
  const [head,...tail]=path;
  if(!head)return source;
  if(!tail.length)return {...source,[head]:value};
  const child=source[head];
  return {...source,[head]:updateAt(child&&typeof child==="object"&&!Array.isArray(child)?child as Record<string,unknown>:{},tail,value)};
}
function Field({name,value,path,onChange}:{name:string;value:unknown;path:string[];onChange:(path:string[],value:unknown)=>void}){
  const isObject=!!value&&typeof value==="object"&&!Array.isArray(value);
  if(isObject){
    const entries=Object.entries(value as Record<string,unknown>);
    const dynamic=["tariffs","roleUpgradeFees","teamRegistrationFees","enabledWorkflows","driverByLicense"].includes(name);
    return <fieldset className="rules-fieldset"><legend>{label(name)}</legend><div className={dynamic?"rules-dynamic-grid":"rules-fields-grid"}>
      {entries.map(([key,child])=><Field key={key} name={key} value={child} path={[...path,key]} onChange={onChange}/>)}
    </div>
    {dynamic&&<AddRule path={path} onAdd={(key,initial)=>onChange([...path,key],initial)}/>}
    </fieldset>;
  }
  if(typeof value==="boolean")return <label className="rules-toggle"><span>{label(name)}</span><input type="checkbox" checked={value} onChange={e=>onChange(path,e.target.checked)}/><i/></label>;
  if(typeof value==="number")return <label className="rules-control"><span>{label(name)}{pctKeys.has(name)?" (%)":""}</span><input type="number" step={pctKeys.has(name)?"0.01":"1"} value={pctKeys.has(name)?String(value*100):value} onChange={e=>onChange(path,pctKeys.has(name)?Number(e.target.value)/100:Number(e.target.value))}/>{pctKeys.has(name)&&<small>Masukkan persen, contoh 10 untuk 10%</small>}</label>;
  return <label className="rules-control"><span>{label(name)}</span><input value={String(value??"")} onChange={e=>onChange(path,e.target.value)}/></label>;
}
function AddRule({path,onAdd}:{path:string[];onAdd:(key:string,value:unknown)=>void}){
  const [key,setKey]=useState("");
  const [value,setValue]=useState("0");
  return <div className="rules-add-row"><input value={key} onChange={e=>setKey(e.target.value)} placeholder="Nama parameter baru"/><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Nilai"/><button type="button" onClick={()=>{const clean=key.trim();if(!clean)return;onAdd(clean,path[0]==="enabledWorkflows"?value==="true":Number(value));setKey("");setValue("0");}}><Plus size={14}/> Tambah</button></div>;
}

export default function EconomyRulesPage() {
  const [season,setSeason]=useState("1");
  const [ruleset,setRuleset]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function load(value=season) {
    setLoading(true);setError("");setMessage("");
    try {
      const response=await fetch(`/api/admin/economy-rules?season=${encodeURIComponent(value)}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Gagal memuat ruleset.");
      setRuleset(data.ruleset);
    } catch(e) { setError(e instanceof Error?e.message:"Gagal memuat ruleset."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load("1");},[]);
  async function save() {
    if(!ruleset)return;
    setSaving(true);setError("");setMessage("");
    try {
      const response=await fetch("/api/admin/economy-rules",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({ruleset})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Gagal menyimpan ruleset.");
      setRuleset(data.ruleset);
      setMessage(`Ruleset Season ${data.ruleset.season} berhasil disimpan.`);
    } catch(e) { setError(e instanceof Error?e.message:"Gagal menyimpan ruleset."); }
    finally { setSaving(false); }
  }
  function change(path:string[],value:unknown){setRuleset(current=>current?updateAt(current,path,value):current);}
  return <main className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand"><span className="admin-brand-mark">C<span>.</span></span><span><b>CALERIS</b><small>MASTERS CONTROL</small></span></Link><div className="admin-sidebar-label">WORKSPACE</div><Link href="/" className="admin-side-active"><span className="side-active-icon"><ArrowLeft size={17}/></span><span><b>Dashboard Admin</b><small>Kembali ke seluruh modul</small></span></Link></aside>
    <section className="admin-main"><header className="admin-topbar"><div className="admin-breadcrumb"><Link href="/">DASHBOARD ADMIN</Link><span>/</span><b>ECONOMY RULES</b></div><span className="admin-secure"><i/> ADMIN SESSION</span></header>
      <div className="admin-content"><div className="sheet-back-row"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Semua modul</Link><span className="sheet-access"><Settings2 size={13}/> SEASON RULESET</span></div>
        <section className="sheet-heading"><div><div className="admin-eyebrow">ECONOMY ENGINE / CONFIGURATION</div><h1>RULES MANAGER</h1><p>Atur tarif, gaji, pajak, denda, development, pinjaman, sponsorship, dan workflow melalui formulir. Tidak perlu menyentuh source code.</p></div><div className="sheet-heading-icon"><Settings2 size={24}/></div></section>
        <div className="sheet-toolbar"><div><span className="admin-eyebrow">VERSIONED CONFIGURATION</span><h2>Aturan Season</h2></div><div className="sheet-actions"><input className="sheet-season-input" type="number" min="1" value={season} onChange={e=>setSeason(e.target.value)} aria-label="Season"/><button className="sheet-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/></button><button className="sheet-add" onClick={()=>void load()} disabled={loading}>Muat Ruleset</button></div></div>
        <div className="sheet-helper"><span>i</span>Nilai persentase ditampilkan sebagai persen. Semua perubahan disimpan sebagai konfigurasi Season dan tidak mengubah transaksi yang sudah tercatat.</div>
        {error&&<div className="sheet-error">{error}</div>}{message&&<div className="sheet-success">{message}</div>}
        {loading&&!ruleset?<div className="sheet-empty">Memuat aturan ekonomi...</div>:ruleset?<div className="rules-editor">{Object.entries(ruleset).filter(([key])=>!["_id","created_at","updated_at","created_by","updated_by"].includes(key)).map(([key,value])=><Field key={key} name={key} value={value} path={[key]} onChange={change}/>)}</div>:<div className="sheet-empty">Ruleset belum tersedia.</div>}
        <div className="sheet-modal-footer"><button className="sheet-save" onClick={()=>void save()} disabled={saving||loading||!ruleset}><Save size={15}/>{saving?"Menyimpan...":"Simpan Ruleset Season"}</button></div>
        <footer className="admin-footer"><span>© 2026 CALERIS MASTERS</span><span>RULESET CONFIGURATION · ADMIN ONLY</span></footer>
      </div>
    </section>
  </main>;
}
