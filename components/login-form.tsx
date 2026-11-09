"use client";

import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight,LockKeyhole,Mail } from "lucide-react";

export function LoginForm(){
 const router=useRouter();
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");setBusy(true);
  try{
   const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"Email atau password tidak valid.");
   router.replace("/");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Login gagal.");}
  finally{setBusy(false);}
 }
 return <form className="login-form" onSubmit={submit}>
  <label className="login-label" htmlFor="email">EMAIL ADMIN</label>
  <div className="login-input-wrap"><Mail size={16}/><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@caleris.id"/></div>
  <label className="login-label" htmlFor="password">PASSWORD</label>
  <div className="login-input-wrap"><LockKeyhole size={16}/><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password"/></div>
  {error&&<p className="login-error" role="alert">{error}</p>}
  <button className="login-submit" type="submit" disabled={busy}>{busy?"MEMERIKSA...":"MASUK KE COMMAND CENTER"} <ArrowRight size={16}/></button>
 </form>;
}
