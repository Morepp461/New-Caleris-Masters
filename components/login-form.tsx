"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = createClient();
    if (!supabase) {
      setError("Koneksi Supabase belum dikonfigurasi.");
      return;
    }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setError("Email atau password tidak valid.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="login-label" htmlFor="email">EMAIL</label>
      <div className="login-input-wrap"><Mail size={16}/><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@caleris.id"/></div>
      <label className="login-label" htmlFor="password">PASSWORD</label>
      <div className="login-input-wrap"><LockKeyhole size={16}/><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password"/></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="login-submit" type="submit" disabled={busy}>{busy?"MEMERIKSA...":"MASUK KE COMMAND CENTER"} <ArrowRight size={16}/></button>
    </form>
  );
}
