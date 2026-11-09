"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Division = { _id: string; name: string; code: string; tier: number; status: string; display_order: number };
type Season = { _id: string; season_number: number; name: string; status: string };
type Ruleset = { _id: string; season_id: string; division_id: string; version: number; status: string; calendar_rules?: Record<string, unknown>; scoring_rules?: Record<string, unknown>; penalty_rules?: Record<string, unknown>; race_rules?: Record<string, unknown>; economy_rules?: Record<string, unknown>; eligibility_rules?: Record<string, unknown> };
type Calendar = { _id: string; season_id: string; division_id: string; total_rounds: number; status: string };
type Circuit = { _id: string; name: string; city: string; country: string };
type CircuitVersion = { _id: string; circuit_id: string; version: number };
type RaceEvent = { _id: string; round_number: number; race_format: string; status: string; calendar_id: string };
type Payload = { divisions: Division[]; seasons: Season[]; calendars: Calendar[]; events: RaceEvent[]; championships: unknown[]; rulesets: Ruleset[]; circuits: Circuit[]; circuitVersions: CircuitVersion[]; entries: unknown[] };
const empty: Payload = { divisions: [], seasons: [], calendars: [], events: [], championships: [], rulesets: [], circuits: [], circuitVersions: [], entries: [] };
const initialJson = '{"points_by_position": {}}';

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
  const [divisionId, setDivisionId] = useState("");
  const [rulesetId, setRulesetId] = useState("");
  const [calendarRules, setCalendarRules] = useState('{"total_rounds": 25}');
  const [scoringRules, setScoringRules] = useState(initialJson);
  const [penaltyRules, setPenaltyRules] = useState("{}");
  const [raceRules, setRaceRules] = useState("{}");
  const [economyRules, setEconomyRules] = useState("{}");
  const [eligibilityRules, setEligibilityRules] = useState("{}");
  const [totalRounds, setTotalRounds] = useState("25");
  const [circuitName, setCircuitName] = useState("");
  const [circuitCity, setCircuitCity] = useState("");
  const [circuitCountry, setCircuitCountry] = useState("");
  const [circuitType, setCircuitType] = useState("PERMANENT");
  const [circuitId, setCircuitId] = useState("");
  const [trackLength, setTrackLength] = useState("5000");
  const [totalCorners, setTotalCorners] = useState("15");
  const [calendarId, setCalendarId] = useState("");
  const [circuitVersionId, setCircuitVersionId] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [totalLaps, setTotalLaps] = useState("25");
  const [raceFormat, setRaceFormat] = useState("FEATURE");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [entryEventId, setEntryEventId] = useState("");
  const [entryPlayerId, setEntryPlayerId] = useState("");
  const [entryTeamId, setEntryTeamId] = useState("");
  const [entryDriverProfileId, setEntryDriverProfileId] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/v1/admin/competition", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Unable to load competition data.");
    setData({ ...empty, ...body.data });
  }, []);
  // Initial server synchronization for the authenticated operator console.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Load failed.")); }, [refresh]);

  async function submit(action: string, payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/admin/competition", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Operation failed.");
      setMessage("Saved successfully.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed."); }
    finally { setBusy(false); }
  }
  function parseJson(value: string, label: string): Record<string, unknown> {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(label + " must be a JSON object.");
    return parsed as Record<string, unknown>;
  }
  function editDraftRuleset(item: Ruleset) {
    setRulesetId(item._id); setSeasonId(item.season_id); setDivisionId(item.division_id);
    setCalendarRules(JSON.stringify(item.calendar_rules ?? {}, null, 2)); setScoringRules(JSON.stringify(item.scoring_rules ?? {}, null, 2));
    setPenaltyRules(JSON.stringify(item.penalty_rules ?? {}, null, 2)); setRaceRules(JSON.stringify(item.race_rules ?? {}, null, 2));
    setEconomyRules(JSON.stringify(item.economy_rules ?? {}, null, 2)); setEligibilityRules(JSON.stringify(item.eligibility_rules ?? {}, null, 2));
    setMessage("Draft ruleset loaded. Edit the JSON fields, then save the draft.");
  }
  async function createRuleset(action = "CREATE_RULESET") {
    try {
      await submit(action, { ...(action === "UPDATE_RULESET" ? { rulesetId } : {}), seasonId, divisionId, calendarRules: parseJson(calendarRules, "Calendar rules"), scoringRules: parseJson(scoringRules, "Scoring rules"), penaltyRules: parseJson(penaltyRules, "Penalty rules"), raceRules: parseJson(raceRules, "Race rules"), economyRules: parseJson(economyRules, "Economy rules"), eligibilityRules: parseJson(eligibilityRules, "Eligibility rules") });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invalid ruleset JSON."); }
  }

  return <main className="competition-shell">
    <header className="competition-header">
      <div><span className="competition-kicker">CALERIS MASTERS / OPERATOR</span><h1>COMPETITION <em>CONTROL.</em></h1><p>Division structure, season regulations, race calendar and championship setup.</p></div>
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
        <div className="competition-list">{data.divisions.map((item) => <article key={item._id}><div><strong>{item.name}</strong><small>{item.code} · TIER {item.tier} · ORDER {item.display_order}</small><div className="competition-inline-actions"><button type="button" disabled={busy || item.status === "ARCHIVED"} onClick={() => void submit("UPDATE_DIVISION", { divisionId: item._id, displayOrder: Math.max(1, item.display_order - 1) })}>ORDER −</button><button type="button" disabled={busy || item.status === "ARCHIVED"} onClick={() => void submit("UPDATE_DIVISION", { divisionId: item._id, displayOrder: item.display_order + 1 })}>ORDER +</button><button type="button" disabled={busy || item.status === "ARCHIVED"} onClick={() => void submit("UPDATE_DIVISION", { divisionId: item._id, status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{item.status === "ACTIVE" ? "DEACTIVATE" : "ACTIVATE"}</button><button type="button" disabled={busy || item.status === "ARCHIVED"} onClick={() => void submit("ARCHIVE_DIVISION", { divisionId: item._id })}>ARCHIVE</button></div></div><span className={item.status === "ACTIVE" ? "state-active" : "state-muted"}>{item.status}</span></article>)}</div>
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
        <div className="competition-action-grid">{["REGISTRATION","ACTIVE","COMPLETED","ARCHIVED"].map((status) => <button type="button" key={status} disabled={busy || !seasonId} onClick={() => void submit("TRANSITION_SEASON", { seasonId, status })}>{status}</button>)}</div>
      </section>
    </div>

    <section className="competition-panel">
      <div className="competition-section-head"><span>04 / REGULATIONS</span><h2>VERSIONED RULESETS</h2></div>
      <div className="competition-list">{data.rulesets.map((item) => <article key={item._id}><div><strong>V{item.version} · {data.seasons.find((s) => s._id === item.season_id)?.name ?? item.season_id.slice(0, 8)}</strong><small>{data.divisions.find((d) => d._id === item.division_id)?.name ?? item.division_id.slice(0, 8)}</small></div><span className={item.status === "LOCKED" ? "state-active" : "state-muted"}>{item.status}</span>{item.status === "DRAFT" && <><button type="button" disabled={busy} onClick={() => editDraftRuleset(item)}>EDIT DRAFT</button><button type="button" disabled={busy} onClick={() => void submit("LOCK_RULESET", { rulesetId: item._id })}>APPROVE & LOCK</button></>}</article>)}</div>
      <div className="competition-form-grid">
        <label>SEASON<select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}><option value="">Select season</option>{data.seasons.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label>DIVISION<select value={divisionId} onChange={(event) => setDivisionId(event.target.value)}><option value="">Select division</option>{data.divisions.filter((item) => item.status === "ACTIVE").map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      </div>
      <div className="competition-json-grid">
        <label>CALENDAR RULES (JSON)<textarea rows={3} value={calendarRules} onChange={(event) => setCalendarRules(event.target.value)} /></label>
        <label>SCORING RULES (JSON)<textarea rows={3} value={scoringRules} onChange={(event) => setScoringRules(event.target.value)} /></label>
        <label>PENALTY RULES (JSON)<textarea rows={3} value={penaltyRules} onChange={(event) => setPenaltyRules(event.target.value)} /></label>
        <label>RACE RULES (JSON)<textarea rows={3} value={raceRules} onChange={(event) => setRaceRules(event.target.value)} /></label>
        <label>ECONOMY RULES (JSON)<textarea rows={3} value={economyRules} onChange={(event) => setEconomyRules(event.target.value)} /></label>
        <label>ELIGIBILITY RULES (JSON)<textarea rows={3} value={eligibilityRules} onChange={(event) => setEligibilityRules(event.target.value)} /></label>
      </div>
      <div className="competition-action-grid"><button type="button" disabled={busy || !seasonId || !divisionId} onClick={() => void createRuleset()}>CREATE RULESET VERSION</button><button type="button" disabled={busy || !rulesetId} onClick={() => void createRuleset("UPDATE_RULESET")}>SAVE DRAFT CHANGES</button><button type="button" disabled={busy || !seasonId || !divisionId || !data.rulesets.some((r) => r.season_id === seasonId && r.division_id === divisionId && r.status === "LOCKED")} onClick={() => void createRuleset("AMEND_RULESET")}>CREATE AMENDMENT VERSION</button></div>
      {rulesetId && <p>Selected ruleset: {rulesetId}</p>}
    </section>

    <div className="competition-columns">
      <section className="competition-panel">
        <div className="competition-section-head"><span>05 / CALENDAR</span><h2>RACE SCHEDULE</h2></div>
        <div className="competition-form-row"><label>SEASON<select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}><option value="">Select season</option>{data.seasons.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>DIVISION<select value={divisionId} onChange={(event) => setDivisionId(event.target.value)}><option value="">Select division</option>{data.divisions.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></div>
        <label>TOTAL ROUNDS<input type="number" min="1" max="100" value={totalRounds} onChange={(event) => setTotalRounds(event.target.value)} /></label>
        <button type="button" disabled={busy || !seasonId || !divisionId} onClick={() => void submit("CREATE_CALENDAR", { seasonId, divisionId, totalRounds: Number(totalRounds) })}>CREATE CALENDAR</button>
        <div className="competition-list">{data.calendars.map((item) => <article key={item._id}><div><strong>{item.total_rounds} ROUNDS</strong><small>{data.seasons.find((s) => s._id === item.season_id)?.name} · {data.divisions.find((d) => d._id === item.division_id)?.name}</small></div><span className={item.status === "ACTIVE" ? "state-active" : "state-muted"}>{item.status}</span>{item.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void submit("ACTIVATE_CALENDAR", { calendarId: item._id })}>ACTIVATE</button>}</article>)}</div>
        <button type="button" disabled={busy || !seasonId || !divisionId} onClick={() => void submit("CREATE_CHAMPIONSHIPS", { seasonId, divisionId })}>CREATE DRIVER & TEAM CHAMPIONSHIPS</button>
      </section>

      <section className="competition-panel">
        <div className="competition-section-head"><span>06 / CIRCUITS</span><h2>TRACK CATALOG</h2></div>
        <div className="competition-list">{data.circuits.map((item) => <article key={item._id}><div><strong>{item.name}</strong><small>{item.city}, {item.country}</small></div><span className="state-active">ACTIVE</span></article>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void submit("CREATE_CIRCUIT", { name: circuitName, city: circuitCity, country: circuitCountry, circuitType }); }}>
          <label>CIRCUIT NAME<input required value={circuitName} onChange={(event) => setCircuitName(event.target.value)} /></label>
          <div className="competition-form-row"><label>CITY<input required value={circuitCity} onChange={(event) => setCircuitCity(event.target.value)} /></label><label>COUNTRY<input required value={circuitCountry} onChange={(event) => setCircuitCountry(event.target.value)} /></label></div>
          <label>CIRCUIT TYPE<select value={circuitType} onChange={(event) => setCircuitType(event.target.value)}><option>PERMANENT</option><option>STREET</option><option>HYBRID</option></select></label>
          <button disabled={busy}>ADD CIRCUIT</button>
        </form>
        <div className="competition-section-head secondary"><span>07 / TRACK VERSION</span><h2>LAYOUT SPECIFICATION</h2></div>
        <label>CIRCUIT<select value={circuitId} onChange={(event) => setCircuitId(event.target.value)}><option value="">Select circuit</option>{data.circuits.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <div className="competition-form-row"><label>LENGTH (METERS)<input type="number" min="100" value={trackLength} onChange={(event) => setTrackLength(event.target.value)} /></label><label>CORNERS<input type="number" min="1" value={totalCorners} onChange={(event) => setTotalCorners(event.target.value)} /></label></div>
        <button type="button" disabled={busy || !circuitId} onClick={() => void submit("CREATE_CIRCUIT_VERSION", { circuitId, trackLengthMeters: Number(trackLength), totalCorners: Number(totalCorners) })}>CREATE TRACK VERSION</button>
      </section>
    </div>

    <section className="competition-panel">
      <div className="competition-section-head"><span>08 / RACE EVENT</span><h2>BUILD THE WEEKEND</h2></div>
      <div className="competition-form-grid">
        <label>CALENDAR<select value={calendarId} onChange={(event) => setCalendarId(event.target.value)}><option value="">Select calendar</option>{data.calendars.map((item) => <option key={item._id} value={item._id}>{data.seasons.find((s) => s._id === item.season_id)?.name} · {data.divisions.find((d) => d._id === item.division_id)?.name}</option>)}</select></label>
        <label>CIRCUIT<select value={circuitId} onChange={(event) => { setCircuitId(event.target.value); setCircuitVersionId(""); }}><option value="">Select circuit</option>{data.circuits.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label>TRACK VERSION<select value={circuitVersionId} onChange={(event) => setCircuitVersionId(event.target.value)}><option value="">Select version</option>{data.circuitVersions.filter((item) => item.circuit_id === circuitId).map((item) => <option key={item._id} value={item._id}>VERSION {item.version}</option>)}</select></label>
        <label>RACE FORMAT<select value={raceFormat} onChange={(event) => setRaceFormat(event.target.value)}><option>FEATURE</option><option>SPRINT</option><option>ENDURANCE</option><option>TIME_TRIAL</option></select></label>
        <label>ROUND<input type="number" min="1" value={roundNumber} onChange={(event) => setRoundNumber(event.target.value)} /></label>
        <label>TOTAL LAPS<input type="number" min="1" value={totalLaps} onChange={(event) => setTotalLaps(event.target.value)} /></label>
        <label>SCHEDULED START<input type="datetime-local" value={scheduledStartAt} onChange={(event) => setScheduledStartAt(event.target.value)} /></label>
      </div>
      <button type="button" disabled={busy || !calendarId || !circuitId || !circuitVersionId || !scheduledStartAt} onClick={() => void submit("CREATE_EVENT", { calendarId, circuitId, circuitVersionId, roundNumber: Number(roundNumber), totalLaps: Number(totalLaps), raceFormat, scheduledStartAt })}>CREATE RACE EVENT</button>
      <div className="competition-list">{data.events.map((item) => <article key={item._id}><div><strong>ROUND {item.round_number} · {item.race_format}</strong><small>{item._id}</small></div><span className={item.status === "COMPLETED" ? "state-active" : "state-muted"}>{item.status}</span><button type="button" disabled={busy || item.status === "REVIEWED" || item.status === "CANCELLED"} onClick={() => { const next: Record<string, string> = { SCHEDULED: "REGISTRATION_LOCKED", REGISTRATION_LOCKED: "READY", READY: "RUNNING", RUNNING: "COMPLETED", COMPLETED: "REVIEWED" }; if (next[item.status]) void submit("TRANSITION_EVENT", { eventId: item._id, status: next[item.status] }); }}>ADVANCE STATE</button></article>)}</div>
    </section>

    <section className="competition-panel">
      <div className="competition-section-head"><span>09 / ENTRY REGISTRATION</span><h2>OFFICIAL GRID ENTRIES</h2></div>
      <div className="competition-form-grid">
        <label>RACE EVENT<select value={entryEventId} onChange={(event) => setEntryEventId(event.target.value)}><option value="">Select scheduled event</option>{data.events.filter((item) => item.status === "SCHEDULED").map((item) => <option key={item._id} value={item._id}>ROUND {item.round_number} · {item.race_format}</option>)}</select></label>
        <label>PLAYER ID<input value={entryPlayerId} onChange={(event) => setEntryPlayerId(event.target.value)} /></label>
        <label>TEAM ID<input value={entryTeamId} onChange={(event) => setEntryTeamId(event.target.value)} /></label>
        <label>DRIVER PROFILE ID<input value={entryDriverProfileId} onChange={(event) => setEntryDriverProfileId(event.target.value)} /></label>
      </div>
      <button type="button" disabled={busy || !entryEventId || !entryPlayerId || !entryTeamId || !entryDriverProfileId} onClick={() => void submit("CREATE_ENTRY", { eventId: entryEventId, playerId: entryPlayerId, teamId: entryTeamId, driverProfileId: entryDriverProfileId })}>REGISTER DRIVER ENTRY</button>
      <p className="competition-footnote">Registration is accepted only while an event is SCHEDULED. Duplicate player/event and driver/event entries are rejected by database uniqueness constraints.</p>
    </section>
    <footer className="competition-footer">CALERIS MASTERS · COMPETITION OPERATIONS</footer>
  </main>;
}
