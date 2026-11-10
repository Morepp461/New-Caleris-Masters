# Phase 10 — Race Engine Prototype

## Scope and boundary
Offline deterministic TypeScript simulation core. No player-facing UI, HTTP route, economy settlement, MongoDB adapter, Railway worker, live spectator stream or production race-control integration. These remain outside Phase 10.

## Implemented engine contract
- CMRE version: CMRE-1.0.0-prototype.
- Mandatory seed; independent deterministic RNG streams for qualifying, performance, weather, incidents, mechanical failures, overtaking, pit execution and strategy.
- Canonical 16 driver and 16 team attributes validated in [50, 200], normalized with N(A) = (A - 50) / 150.
- Qualifying, race start, configurable segment/lap simulation, classification and deterministic event log.
- Tyre compound, temperature, nonlinear degradation and grip; dynamic weather transitions.
- DRS eligibility by zone/gap and Safety Car state; ERS energy budget.
- Overtake attempt/success/failure and defensive outcomes.
- Component-level engine, gearbox, suspension, brake and electrical wear; weakest-component failure and retirement.
- Incident classification, Safety Car deployment and mandatory pit-stop penalty.
- Automated expected-value pit strategy considering track time, pit loss, tyre wear, weather suitability and risk. Strategy Quality reduces decision error; fixed preconfigured strategy is supported.
- Pit lifecycle events: entry, service start, tyre change, exit and completion.
- Checkpoint lifecycle, stable IDs, engine/input compatibility, full RNG state and event history; resume and replay validation.
- Result JSON export, Monte Carlo distributions, paired sensitivity metrics and 20/40/60-driver benchmark.

## Monaco reference profile
Circuit de Monaco 2026 is the prototype reference:
- Track length 3,337 m; 19-turn sequence and named landmark groups.
- Sector distances: 1,051 m / 1,419 m / 867 m.
- Sector split references: 60 m before Turn 5 and 70 m before Turn 13.
- Speed-trap reference: 190 m before Turn 10.
- 2026 Overtake Mode references stored separately; DRS disabled in the Monaco profile.

**Important limitation:** the circuit dataset remains `CALIBRATION_DRAFT`. The profile currently models three sector segments, not surveyed per-corner centreline coordinates, radii, elevation samples, exact braking references or official per-corner timing. The 80,000 ms lap reference and segment factors are provisional model values, not official F1 performance data. Do not treat the profile as a validated real-world circuit dataset.

Sources:
- FIA 2026 Monaco circuit map and pit-lane drawing: https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf
- FIA 2025 Monaco circuit map: https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_-_circuit_map_pit_lane_map_ers_battery_containment_area_red_zones.pdf
- Formula 1 Monaco corner guide: https://www.formula1.com/en/latest/article/explained-how-every-monaco-corner-got-its-name.5ClYqWmfpeUpsRJA6mDNaX

## Calibration and acceptance
- Unit and integration coverage: boundaries 50/125/200 and invalid 49/201; directional behavior; circuit/weather effects; incidents, Safety Car, mechanical failure, pit lifecycle, DRS/ERS, strategy, tie-breaks, checkpoint recovery and deterministic replay.
- `npm run race:calibrate -- --runs=1000`: 1,000 full-grid Monte Carlo runs and 1,000 paired seeds for each of all 32 attribute comparisons. Metrics include race/lap time, win/podium rates, retirements, overtakes, incidents, mechanical failures, tyre wear and pit loss.
- `npm run race:benchmark`: 20/40/60-driver throughput; hardware-dependent results are not production capacity guarantees.
- Review the generated balance report for zero/weak effects and distribution anomalies before declaring balance final.

## Database and infrastructure
No database schema, seed or migration is introduced. The engine does not connect to `caleris_masters_dev` or production. Production MongoDB remains untouched. No Railway worker or Vercel runtime integration is added; persistent workers and live race orchestration belong to Phase 11.
