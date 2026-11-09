"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EconomyAccount = { _id: string; owner_type: string; owner_id: string; status: string; available_balance_minor: unknown };
type DevelopmentWallet = { _id: string; owner_type: string; owner_id: string; token_type: string; balance: unknown };
type LedgerTransaction = { _id: string; category: string; status: string; created_at: string | Date; amount_minor: unknown };
type Ruleset = { _id: string; season_id: string; version: number; status: string; [key: string]: unknown };
type EconomyPeriod = { _id: string; season_id: string; period_number: number; status: string; start_at: string | Date; end_at: string | Date };
type Loan = { _id: string; team_id: string; principal_minor: unknown; remaining_principal_minor: unknown; status: string; due_at: string | Date };
type Season = { _id: string; season_number: number; name: string; status: string };
type Payload = { operator: boolean; accounts: EconomyAccount[]; developmentWallets: DevelopmentWallet[]; transactions: LedgerTransaction[]; developmentTransactions: unknown[]; rulesets: Ruleset[]; periods: EconomyPeriod[]; loans: Loan[]; seasons: Season[]; economyActivation: string };
const money = (value: unknown) => {
  const amount = typeof value === "object" && value && "toString" in value ? String(value) : String(value ?? 0);
  return "¢p " + new Intl.NumberFormat("id-ID").format(Number(amount));
};
export default function EconomyConsole() {
  const [data, setData] = useState<Payload | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [form, setForm] = useState({ sourceAccountId: "", destinationAccountId: "", amountMinor: "", reason: "", idempotencyKey: "" });
  const [account, setAccount] = useState({ ownerType: "PLAYER", ownerId: "" });
  const [token, setToken] = useState({ ownerType: "PLAYER", ownerId: "", tokenType: "DDP", amount: "", reason: "", idempotencyKey: "" });
  const [ruleset, setRuleset] = useState({ seasonId: "", rulesetId: "", rulesJson: "" });
  const [period, setPeriod] = useState({ seasonId: "", periodNumber: "1", startAt: "", endAt: "" });
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/economy", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message ?? "Economy data could not be loaded.");
    setData(json.data);
  }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((e) => setError(e.message)); }, [load]);
  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/v1/economy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? action + " failed.");
      setMessage(action + " completed.");
      await load();
      return json.data;
    } catch (e) { setError(e instanceof Error ? e.message : action + " failed."); throw e; }
    finally { setBusy(false); }
  }
  async function transfer(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await runAction("TRANSFER", { ...form, amountMinor: Number(form.amountMinor), category: "MANUAL_TRANSFER" });
      setMessage("Ledger transaction posted: " + result.transactionId);
      setForm({ sourceAccountId: "", destinationAccountId: "", amountMinor: "", reason: "", idempotencyKey: "" });
    } catch { /* feedback is shown above */ }
  }
  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    try { await runAction("CREATE_ACCOUNT", account); setAccount({ ...account, ownerId: "" }); }
    catch { /* feedback is shown above */ }
  }
  async function grantTokens(event: React.FormEvent) {
    event.preventDefault();
    try {
      await runAction("GRANT_TOKENS", { ...token, amount: Number(token.amount) });
      setToken({ ...token, amount: "", reason: "", idempotencyKey: "" });
    } catch { /* feedback is shown above */ }
  }
  async function createRuleset(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await runAction("CREATE_RULESET", { seasonId: ruleset.seasonId });
      setRuleset({ seasonId: ruleset.seasonId, rulesetId: result.rulesetId, rulesJson: JSON.stringify(result.rules, null, 2) });
    } catch { /* feedback is shown above */ }
  }
  async function updateRuleset(event: React.FormEvent) {
    event.preventDefault();
    try { await runAction("UPDATE_RULESET", { rulesetId: ruleset.rulesetId, rules: JSON.parse(ruleset.rulesJson) as Record<string, unknown> }); }
    catch (e) { if (e instanceof SyntaxError) setError("Ruleset JSON is invalid."); }
  }
  async function createPeriod(event: React.FormEvent) {
    event.preventDefault();
    try { await runAction("CREATE_PERIOD", { ...period, periodNumber: Number(period.periodNumber) }); }
    catch { /* feedback is shown above */ }
  }
  return <section style={{maxWidth:1180,margin:"0 auto",padding:"22px 0"}}>
    <header className="profile-header"><div><div className="profile-kicker">CALERIS MASTERS / FINANCIAL SYSTEM</div><h1 style={{font:"48px Anton",margin:"12px 0"}}>ECONOMY <em style={{color:"var(--red)",fontStyle:"normal"}}>CONTROL</em></h1></div><Link href="/" className="login-link">BACK TO HOME ↗</Link></header>
    <p style={{color:"var(--muted)",fontSize:12,lineHeight:1.8}}>¢p ledger, player/team wallets, and separate DDP/TDP development wallets. All economic rules remain disabled until explicitly approved.</p>
    {error && <div className="auth-notice" role="alert">{error}</div>}{message && <div className="auth-notice" role="status">{message}</div>}
    {!data ? <p>Loading economy data…</p> : <>
      <div className="quest-stats" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <article><small>VISIBLE CP ACCOUNTS</small><strong>{data.accounts.length}</strong></article>
        <article><small>DEVELOPMENT WALLETS</small><strong>{data.developmentWallets.length}</strong></article>
        <article><small>ECONOMY RULES</small><strong>{data.economyActivation === "OFF_UNTIL_APPROVED" ? "OFF" : "—"}</strong></article>
      </div>
      <section className="quest-panel"><div className="quest-panel-head">CP WALLETS <strong>DOUBLE-ENTRY LEDGER</strong></div>
        {data.accounts.length ? <div className="quest-list">{data.accounts.map((a) => <article key={a._id}><div><b>{a.owner_type} / {a.owner_id}</b><small>{a._id} · {a.status}</small></div><span>{money(a.available_balance_minor)}</span></article>)}</div> : <p className="quest-empty">No wallet accounts exist. Migration did not seed any balance.</p>}
      </section>
      <section className="quest-panel"><div className="quest-panel-head">DEVELOPMENT WALLETS <strong>DDP ≠ TDP ≠ ¢p</strong></div>
        {data.developmentWallets.length ? <div className="quest-list">{data.developmentWallets.map((w) => <article key={w._id}><div><b>{w.owner_type} / {w.owner_id}</b><small>{w.token_type} · {w._id}</small></div><span>{String(w.balance ?? 0)} {w.token_type}</span></article>)}</div> : <p className="quest-empty">No development tokens have been issued.</p>}
      </section>
      {data.operator && <>
        <section className="quest-panel"><div className="quest-panel-head">OPEN WALLET <strong>ZERO INITIAL BALANCE</strong></div>
          <form className="quest-form" onSubmit={createAccount}><div className="quest-grid"><label>Account owner type<select value={account.ownerType} onChange={(e)=>setAccount({...account,ownerType:e.target.value})}><option value="PLAYER">PLAYER</option><option value="TEAM">TEAM</option><option value="SYSTEM">SYSTEM / BANK</option></select></label><label>Owner UUID<input required value={account.ownerId} onChange={(e)=>setAccount({...account,ownerId:e.target.value})}/></label></div><button disabled={busy}>CREATE ZERO-BALANCE ACCOUNT</button></form>
        </section>
        <section className="quest-panel"><div className="quest-panel-head">OPERATOR TRANSFER <strong>FUNDED SOURCE + REASON + IDEMPOTENCY</strong></div>
          <form className="quest-form" onSubmit={transfer}>
            <div className="quest-grid"><label>Source account ID<input required value={form.sourceAccountId} onChange={(e)=>setForm({...form,sourceAccountId:e.target.value})}/></label><label>Destination account ID<input required value={form.destinationAccountId} onChange={(e)=>setForm({...form,destinationAccountId:e.target.value})}/></label><label>Amount in minor units<input required type="number" min="1" step="1" value={form.amountMinor} onChange={(e)=>setForm({...form,amountMinor:e.target.value})}/></label><label>Idempotency key<input required minLength={8} value={form.idempotencyKey} onChange={(e)=>setForm({...form,idempotencyKey:e.target.value})}/></label></div>
            <label>Reason<textarea required minLength={8} value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></label><button disabled={busy}>{busy ? "POSTING…" : "POST TRANSFER"}</button>
          </form>
        </section>
        <section className="quest-panel"><div className="quest-panel-head">DEVELOPMENT TOKEN ADJUSTMENT <strong>DDP / TDP LEDGER</strong></div>
          <form className="quest-form" onSubmit={grantTokens}>
            <div className="quest-grid"><label>Owner type<select value={token.ownerType} onChange={(e)=>setToken({...token,ownerType:e.target.value,tokenType:e.target.value==="PLAYER"?"DDP":"TDP"})}><option value="PLAYER">PLAYER</option><option value="TEAM">TEAM</option></select></label><label>Token type<select value={token.tokenType} onChange={(e)=>setToken({...token,tokenType:e.target.value})}><option value="DDP">DDP</option><option value="TDP">TDP</option></select></label><label>Owner UUID<input required value={token.ownerId} onChange={(e)=>setToken({...token,ownerId:e.target.value})}/></label><label>Amount<input required type="number" min="1" step="1" value={token.amount} onChange={(e)=>setToken({...token,amount:e.target.value})}/></label><label>Idempotency key<input required minLength={8} value={token.idempotencyKey} onChange={(e)=>setToken({...token,idempotencyKey:e.target.value})}/></label></div>
            <label>Reason<textarea required minLength={8} value={token.reason} onChange={(e)=>setToken({...token,reason:e.target.value})}/></label><button disabled={busy}>POST TOKEN GRANT</button>
          </form>
        </section>
        <section className="quest-panel"><div className="quest-panel-head">VERSIONED ECONOMY RULESETS <strong>ALL RULE GROUPS DEFAULT OFF</strong></div>
          <form className="quest-form" onSubmit={createRuleset}><label>Season ID<input required value={ruleset.seasonId} onChange={(e)=>setRuleset({...ruleset,seasonId:e.target.value})}/></label><button disabled={busy}>CREATE DRAFT RULESET</button></form>
          {data.rulesets.map((r)=><article key={r._id} className="quest-list"><div><b>Season {r.season_id} · v{r.version} · {r.status}</b><small>{r._id}</small></div><button type="button" onClick={()=>setRuleset({seasonId:r.season_id,rulesetId:r._id,rulesJson:JSON.stringify(Object.fromEntries(Object.entries(r).filter(([key])=>key.endsWith("_rules"))),null,2)})}>LOAD</button></article>)}
          <form className="quest-form" onSubmit={updateRuleset}><label>Draft ruleset ID<input required value={ruleset.rulesetId} onChange={(e)=>setRuleset({...ruleset,rulesetId:e.target.value})}/></label><label>Rules JSON<textarea required rows={12} value={ruleset.rulesJson} onChange={(e)=>setRuleset({...ruleset,rulesJson:e.target.value})}/></label><div className="quest-grid"><button disabled={busy}>SAVE DRAFT RULES</button><button type="button" disabled={busy||!ruleset.rulesetId} onClick={()=>runAction("ACTIVATE_RULESET",{rulesetId:ruleset.rulesetId}).catch(()=>undefined)}>ACTIVATE VERSION</button></div></form>
        </section>
        <section className="quest-panel"><div className="quest-panel-head">ECONOMY PERIODS <strong>PERIOD CLOSE / RECONCILIATION</strong></div>
          <form className="quest-form" onSubmit={createPeriod}><div className="quest-grid"><label>Season ID<input required value={period.seasonId} onChange={(e)=>setPeriod({...period,seasonId:e.target.value})}/></label><label>Period number<input required type="number" min="1" step="1" value={period.periodNumber} onChange={(e)=>setPeriod({...period,periodNumber:e.target.value})}/></label><label>Start at<input required type="datetime-local" value={period.startAt} onChange={(e)=>setPeriod({...period,startAt:e.target.value})}/></label><label>End at<input required type="datetime-local" value={period.endAt} onChange={(e)=>setPeriod({...period,endAt:e.target.value})}/></label></div><button disabled={busy}>OPEN ECONOMY PERIOD</button></form>
          {data.periods.map((p)=><article className="quest-list" key={p._id}><div><b>Period {p.period_number} · {p.status}</b><small>{p._id} · {new Date(p.start_at).toLocaleDateString("id-ID")} – {new Date(p.end_at).toLocaleDateString("id-ID")}</small></div>{p.status==="OPEN"&&<button type="button" disabled={busy} onClick={()=>runAction("CLOSE_PERIOD",{periodId:p._id,reason:"Operator period close and reconciliation."}).catch(()=>undefined)}>CLOSE & RECONCILE</button>}</article>)}
        </section>
      </>}
      <section className="quest-panel"><div className="quest-panel-head">TEAM LOANS <strong>RULE-GATED</strong></div>
        {data.loans.length ? <div className="quest-list">{data.loans.map((loan)=><article key={loan._id}><div><b>Team {loan.team_id} · {loan.status}</b><small>{loan._id} · Due {new Date(loan.due_at).toLocaleDateString("id-ID")}</small></div><span>{money(loan.remaining_principal_minor)}</span></article>)}</div> : <p className="quest-empty">No team loans have been issued.</p>}
      </section>
      <section className="quest-panel"><div className="quest-panel-head">LATEST LEDGER TRANSACTIONS <strong>IMMUTABLE HISTORY</strong></div>
        {data.transactions.length ? <div className="quest-list">{data.transactions.map((t)=><article key={t._id}><div><b>{t.category} · {t.status}</b><small>{t._id} · {new Date(t.created_at).toLocaleString("id-ID")}</small></div><span>{money(t.amount_minor)}</span></article>)}</div> : <p className="quest-empty">No financial transactions have been posted.</p>}
      </section>
    </>}
  </section>;
}