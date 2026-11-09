"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ImagePlus, UploadCloud } from "lucide-react";

export default function ImportAssetsPage() {
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function upload() {
    if(!file)return;
    setBusy(true);setMessage("");
    try {
      const form=new FormData();form.set("backup",file);
      const response=await fetch("/api/admin/import-assets",{method:"POST",body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Import gagal");
      setMessage(`Berhasil: ${data.memberAssets} avatar member dan ${data.teamAssets} logo tim. ${data.membersProcessed} member dan ${data.teamsProcessed} tim diproses.`);
    } catch(error) { setMessage(error instanceof Error?error.message:"Import gagal"); }
    finally { setBusy(false); }
  }
  return <main className="admin-shell"><section className="admin-main" style={{marginLeft:0,width:"100%"}}>
    <header className="admin-topbar"><Link href="/" className="sheet-back"><ArrowLeft size={15}/> Dashboard Admin</Link><span className="admin-secure"><i/> ADMIN SESSION</span></header>
    <div className="admin-content"><section className="sheet-heading"><div><div className="admin-eyebrow">DATA MIGRATION / PROFILE ASSETS</div><h1>IMPORT AVATAR & LOGO</h1><p>Lengkapi foto profil member dan identitas visual tim dari backup asli.</p></div><div className="sheet-heading-icon"><ImagePlus size={24}/></div></section>
      <section className="sheet-panel" style={{padding:24,maxWidth:720}}>
        <p>Upload file <b>caleris-backup-2026-11-08.json</b>. Sistem hanya mengambil foto member dan data/logo tim. Riwayat transaksi, saldo, dan data lain tidak akan ditimpa.</p>
        <label className="sheet-field" style={{marginTop:20}}><span>File backup JSON</span><input type="file" accept=".json,application/json" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
        <button className="sheet-add" style={{marginTop:20}} disabled={!file||busy} onClick={()=>void upload()}><UploadCloud size={16}/>{busy?"Mengimpor aset...":"Import aset profil"}</button>
        {message&&<div className="sheet-helper" style={{marginTop:18}}>{message}</div>}
      </section>
    </div>
  </section></main>;
}
