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
        <p className="login-intro">Akun berhasil masuk, tetapi belum memiliki profil dengan role administrator di database Caleris Masters. Admin awal perlu ditetapkan sebelum panel operasional dibuka.</p>
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

  const [membersResult,teamsResult,transactionsResult,loansResult,seasonResult,bankResult] = await Promise.all([
    supabase.from("member_balance_summary").select("*").neq("role","admin"),
    supabase.from("team_balance_summary").select("*"),
    supabase.from("transactions").select("id,transaction_date,member_id,direction,category,amount,description").order("transaction_date",{ascending:false}).limit(100),
    supabase.from("bank_loans").select("id,team_id,principal_amount,borrowed_at,due_at,status,repayment_amount").order("borrowed_at",{ascending:false}).limit(100),
    supabase.from("seasons").select("season_number,race_current,balancing_period").eq("is_active",true).maybeSingle(),
    supabase.from("bank_financial_summary").select("current_bank_balance").maybeSingle(),
  ]);

  const members = (membersResult.data ?? []).map(member => ({
    ...member,
    team_name: teamsResult.data?.find(team=>team.team_id===member.current_team_id)?.team_name ?? undefined,
  }));
  const teams = teamsResult.data ?? [];
  const memberNames = new Map(members.map(member=>[member.member_id??"",member.display_name??""]));
  const teamNames = new Map(teams.map(team=>[team.team_id??"",team.team_name??""]));
  const transactions = (transactionsResult.data ?? []).map(transaction=>({
    ...transaction,
    member_name:memberNames.get(transaction.member_id)??"Anggota",
  }));
  const loans = (loansResult.data ?? []).map(loan=>({
    ...loan,
    team_name:teamNames.get(loan.team_id)??"Tim",
  }));

  const stats = {
    members: members.length,
    teams: teams.length,
    circulatingBalance: members.reduce((sum,row)=>sum+Number(row.ending_balance??0),0),
    racesCompleted: seasonResult.data?.race_current ?? 0,
    balancingPeriod: seasonResult.data?.balancing_period ?? 0,
    season: seasonResult.data?.season_number ?? 0,
    bankBalance: Number(bankResult.data?.current_bank_balance ?? 0),
  };

  return <Dashboard stats={stats} members={members} teams={teams} transactions={transactions} loans={loans}/>;
}
