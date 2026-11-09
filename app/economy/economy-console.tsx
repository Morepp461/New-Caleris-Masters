"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EconomyAccount = { _id: string; owner_type: string; owner_id: string; status: string; available_balance_minor: unknown };
type DevelopmentWallet = { _id: string; owner_type: string; owner_id: string; token_type: string; balance: unknown };
type LedgerTransaction = { _id: string; category: string; status: string; created_at: string | Date; amount_minor: unknown };
type Payload = { operator: boolean; accounts: EconomyAccount[]; developmentWallets: DevelopmentWallet[]; transactions: LedgerTransaction[]; developmentTransactions: unknown[]; rulesets: unknown[]; periods: unknown[]; economyActivation: string };
const money = (value: unknown) => {
  const amount = typeof value === "object" && value && "toString" in value ? String(value) : String(value ?? 0);
  return "¢p " + new Intl.NumberFormat("id-ID").format(Number(amount));
};
export default function EconomyConsole() {
  const [data, setData] = useState<Payload | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [form, setForm] = useState({ sourceAccountId: "", destinationAccountId: "", amountMinor: "", reason: "", idempotencyKey: "" });
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/economy", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message ?? "Economy data could not be loaded.");
    setData(json.data);
  }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((e) => setError(e.message)); }, [load]);
  async function transfer(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/v1/economy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "TRANSFER", ...form, category: "MANUAL_TRANSFER" }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? "Transfer failed.");
      setMessage("Ledger transaction posted: " + json.data.transactionId);
      setForm({ sourceAccountId: "", destinationAccountId: "", amountMinor: "", reason: "", idempotencyKey: "" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Transfer failed."); }
    finally { setBusy(false); }
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
      {data.operator && <section className="quest-panel"><div className="quest-panel-head">OPERATOR TRANSFER <strong>REQUIRES FUNDED SOURCE + REASON</strong></div>
        <form className="quest-form" onSubmit={transfer}>
          <div className="quest-grid"><label>Source account ID<input required value={form.sourceAccountId} onChange={(e)=>setForm({...form,sourceAccountId:e.target.value})}/></label><label>Destination account ID<input required value={form.destinationAccountId} onChange={(e)=>setForm({...form,destinationAccountId:e.target.value})}/></label><label>Amount in minor units<input required type="number" min="1" step="1" value={form.amountMinor} onChange={(e)=>setForm({...form,amountMinor:e.target.value})}/></label><label>Idempotency key<input required minLength={8} value={form.idempotencyKey} onChange={(e)=>setForm({...form,idempotencyKey:e.target.value})}/></label></div>
          <label>Reason<textarea required minLength={8} value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></label>
          <button disabled={busy}>{busy ? "POSTING…" : "POST TRANSFER"}</button>
        </form>
      </section>}
      <section className="quest-panel"><div className="quest-panel-head">LATEST LEDGER TRANSACTIONS <strong>IMMUTABLE HISTORY</strong></div>
        {data.transactions.length ? <div className="quest-list">{data.transactions.map((t)=><article key={t._id}><div><b>{t.category} · {t.status}</b><small>{t._id} · {new Date(t.created_at).toLocaleString("id-ID")}</small></div><span>{money(t.amount_minor)}</span></article>)}</div> : <p className="quest-empty">No financial transactions have been posted.</p>}
      </section>
    </>}
  </section>;
}