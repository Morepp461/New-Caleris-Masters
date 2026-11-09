"use client";

import Link from "next/link";\nimport { useCallback, useEffect, useState } from "react";

type Division = { _id: string; name: string; code: string; tier: number; status: string; display_order: number };
type Season = { _id: string; season_number: number; name: string; status: string; start_date?: string };
type Payload = { divisions: Division[]; seasons: Season[]; calendars: unknown[]; events: unknown[]; championships: unknown[] };
const empty: Payload = { divisions: [], seasons: [], calendars: [], events: [], championships: [] };

export default function CompetitionConsole() {
  const [data, setData] = useState<Payload>(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [divisionCode, setDivisionCode] = useState("");
  const [divisionTier, setDivisionTier] = useState("3");
  const [seasonName, setSeasonName] = useState("");
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonId, setSeasonId] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/v1/admin/competition", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Unable to load competition data.");
    setData(body.data);
  }, []);
  // Initial server synchronization for the authenticated operator console.\n  // eslint-disable-next-line react-hooks/set-state-in-effect\n  useEffect(() => { refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Load failed.")); }, [refresh]);

  async function submit(action: string, payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/admin/competition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Operation failed.");
      setMessage("Saved successfully.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed.");
    } finally { setBusy(false); }
  }

  return <main className="competition-shell">
    <header className="competition-header">
      <div><span className="competition-kicker">CALERIS MASTERS / OPERATOR</span><h1>COMPETITION <em>CONTROL.</em></h1><p>Divisions, seasons, regulations and race scheduling.</p></div>
      <Link href="/">← BACK TO WORLD</Link>
    </header>
    {message && <div className="competition-notice" role="status">{message}</div>}
    <section className="competition-stats">
      <article><span>DIVISIONS</span><strong>{data.divisions.length.toString().padStart(2, "0")}</strong></article>
      <article><span>SEASONS</span><strong>{data.seasons.length.toString().padStart(2, "0")}</strong></article>
      <article><span>CALENDARS</span><strong>{data.calendars.length.toString().padStart(2, "0")}</strong></article>
      <article><span>RACE EVENTS</span><strong>{data.events.length.toString().padStart(2, "0")}</strong></article>
    </section>
    <div className="competition-columns">
      <section className="competition-panel">
        <div className="competition-section-head"><span>01 / DIVISION MANAGEMENT</span><h2>THE GRIDS</h2></div>
        <div className="competition-list">{data.divisions.map((item) => <article key={item._id}><div><strong>{item.name}</strong><small>{item.code} · TIER {item.tier} · ORDER {item.display_order}</small></div><span className={item.status === "ACTIVE" ? "state-active" : "state-muted"}>{item.status}</span></article>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void submit("CREATE_DIVISION", { name: divisionName, code: divisionCode, tier: Number(divisionTier) }); }}>
          <label>DIVISION NAME<input required minLength={3} maxLength={60} value={divisionName} onChange={(event) => setDivisionName(event.target.value)} /></label>
          <div className="competition-form-row"><label>CODE<input required maxLength={12} value={divisionCode} onChange={(event) => setDivisionCode(event.target.value.toUpperCase())} /></label><label>TIER<input required type="number" min="1" max="20" value={divisionTier} onChange={(event) => setDivisionTier(event.target.value)} /></label></div>
          <button disabled={busy}>CREATE DIVISION</button>
        </form>
      </section>
      <section className="competition-panel">
        <div className="competition-section-head"><span>02 / SEASON MANAGEMENT</span><h2>THE SEASONS</h2></div>
        <div className="competition-list">{data.seasons.map((item) => <article key={item._id}><div><strong>{item.name}</strong><small>SEASON {item.season_number}</small></div><span className={item.status === "ACTIVE" ? "state-active" : "state-muted"}>{item.status}</span></article>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void submit("CREATE_SEASON", { name: seasonName, seasonNumber: Number(seasonNumber) }); }}>
          <label>SEASON NAME<input required minLength={2} maxLength={60} value={seasonName} onChange={(event) => setSeasonName(event.target.value)} /></label>
          <label>SEASON NUMBER<input required type="number" min="1" value={seasonNumber} onChange={(event) => setSeasonNumber(event.target.value)} /></label>
          <button disabled={busy}>CREATE SEASON</button>
        </form>
        <div className="competition-section-head secondary"><span>03 / LIFECYCLE</span><h2>SEASON STATE</h2></div>
        <label>SELECT SEASON<select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}><option value="">Choose a season</option>{data.seasons.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.status}</option>)}</select></label>
        <div className="competition-action-grid">{["REGISTRATION","ACTIVE","COMPLETED","ARCHIVED"].map((status) => <button key={status} disabled={busy || !seasonId} onClick={() => void submit("TRANSITION_SEASON", { seasonId, status })}>{status}</button>)}</div>
      </section>
    </div>
    <section className="competition-panel competition-wide">
      <div className="competition-section-head"><span>04 / COMPETITION INVENTORY</span><h2>CALENDAR & CHAMPIONSHIPS</h2></div>
      <p>Calendars: {data.calendars.length} · Events: {data.events.length} · Championships: {data.championships.length}</p>
      <p className="competition-footnote">Detailed calendar, event, ruleset and entry operations are exposed through the authenticated competition API. Rulesets are versioned and locked before season activation.</p>
    </section>
    <footer className="competition-footer">CALERIS MASTERS · COMPETITION OPERATIONS</footer>
  </main>;
}
