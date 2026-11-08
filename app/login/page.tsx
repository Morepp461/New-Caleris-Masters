import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect("/");
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand"><div className="brand-mark">C<span>.</span></div><div><div className="brand-name">CALERIS</div><div className="brand-sub">MASTERS CONTROL</div></div></div>
        <div className="eyebrow">RESTRICTED PADDOCK ACCESS</div>
        <h1>WELCOME BACK.</h1>
        <p className="login-intro">Masuk menggunakan akun resmi Caleris Masters.</p>
        <LoginForm/>
        <div className="login-foot">AUTHORIZED PERSONNEL ONLY <span>·</span> CALERIS MASTERS</div>
      </div>
    </main>
  );
}
