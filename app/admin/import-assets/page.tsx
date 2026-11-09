"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ImagePlus, UploadCloud, CheckCircle2, AlertCircle, FileJson } from "lucide-react";

export default function ImportAssetsPage() {
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{kind:"success"|"error";text:string}|null>(null);

  async function upload() {
    if(!file)return;
    setBusy(true);setResult(null);
    try {
      const form=new FormData();
      form.set("backup",file);
      const response=await fetch("/api/admin/import-assets",{method:"POST",body:form});
      const data=await response.json().catch(()=>({error:"Server mengembalikan respons yang tidak valid."}));
      if(!response.ok)throw new Error(data.error??`Import gagal (HTTP ${response.status}).`);
      setResult({
        kind:"success",
        text:`Import selesai. ${data.memberAssets} avatar member diperbarui dari ${data.memberRowsMatched} profil yang cocok. ${data.teamAssets} logo tim tersimpan. ${data.teamProfilesProcessed} profil tim diproses. ${data.memberAssetsSkipped} foto dilewati karena kosong atau profil tidak ditemukan. Data transaksi dan saldo tidak disentuh.`
      });
    } catch(error) {
      setResult({kind:"error",text:error instanceof Error?error.message:"Import gagal. Periksa koneksi lalu coba lagi."});
    } finally { setBusy(false); }
  }

  return <main className="admin-shell"><section className="admin-main" style={{marginLeft:0,width:"100%"}}>
    <header className="admin-topbar"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Dashboard Admin</Link><span className="admin-secure"><i/> ADMIN SESSION</span></header>
    <div className="admin-content">
      <div className="sheet-back-row"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Semua modul</Link><span className="sheet-access">DATA MIGRATION</span></div>
      <section className="sheet-heading"><div><div className="admin-eyebrow">DATA MIGRATION / PROFILE ASSETS</div><h1>IMPORT AVATAR & LOGO</h1><p>Lengkapi foto profil member dan identitas visual tim dari backup asli.</p></div><div className="sheet-heading-icon"><ImagePlus size={24}/></div></section>
      <section className="sheet-panel import-panel">
        <div className="import-intro"><span className="import-file-icon"><FileJson size={22}/></span><div><b>Backup Caleris Masters</b><p>Ambil hanya avatar member, logo, dan profil tim. Riwayat transaksi, saldo, serta konfigurasi ekonomi tidak akan ditimpa.</p></div></div>
        <label className="import-dropzone">
          <input type="file" accept=".json,application/json" onChange={e=>{setFile(e.target.files?.[0]??null);setResult(null);}}/>
          <UploadCloud size={25}/>
          <b>{file?file.name:"Pilih file backup JSON"}</b>
          <span>{file?`${(file.size/1024/1024).toFixed(2)} MB · Siap diimpor`:"Format .json · Maksimal 12 MB"}</span>
        </label>
        <button className="sheet-add import-submit" disabled={!file||busy} onClick={()=>void upload()}><UploadCloud size={16}/>{busy?"Sedang mengimpor...":"Mulai Import"}</button>
        {result&&<div className={result.kind==="success"?"import-result import-result-success":"import-result import-result-error"}>{result.kind==="success"?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<span>{result.text}</span></div>}
      </section>
      <footer className="admin-footer"><span>© 2026 CALERIS MASTERS</span><span>PROFILE ASSET MIGRATION · ADMIN ONLY</span></footer>
    </div>
  </section></main>;
}
