import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { createClient } from "@/lib/supabase/server";

function AccessPending() {
  return (
    <main className="login-page">
      <section className="login-card access-card">
        <div className="login-brand"><div className="brand-mark">C<span>.</span></div><div><div className="brand-name">CALERIS</div><div className="brand-sub">MASTERS CONTROL</div></div></div>
        <div className="eyebrow">ACCOUNT REVIEW</div>
        <h1>ACCESS PENDING.</h1>
        <p className="login-intro">Akun berhasil masuk, tetapi belum memiliki profil dengan role administrator di database Caleris Masters. Hubungi administrator platform untuk mengaktifkan akses.</p>
        <a className="login-back" href="/login">Kembali ke login</a>
      </section>
    </main>
  );
}

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) return <Dashboard />;

  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("role,display_name")
    .eq("user_id", String(userId))
    .maybeSingle();

  if (profile?.role !== "admin") return <AccessPending />;

  const [members,teams,balances,season,bank] = await Promise.all([
    supabase.from("member_profiles").select("id",{count:"exact",head:true}),
    supabase.from("teams").select("id",{count:"exact",head:true}),
    supabase.from("member_balance_summary").select("ending_balance"),
    supabase.from("seasons").select("season_number,race_current,balancing_period").eq("is_active",true).maybeSingle(),
    supabase.from("bank_financial_summary").select("current_bank_balance").maybeSingle(),
  ]);

  const stats = {
    members: members.count ?? 0,
    teams: teams.count ?? 0,
    circulatingBalance: (balances.data ?? []).reduce((sum,row)=>sum+Number(row.ending_balance ?? 0),0),
    racesCompleted: season.data?.race_current ?? 0,
    balancingPeriod: season.data?.balancing_period ?? 0,
    season: season.data?.season_number ?? 0,
    bankBalance: Number(bank.data?.current_bank_balance ?? 0),
  };

  return <Dashboard stats={stats}/>;
}
