# Phase 10 — CMRE Race Engine Prototype

## Scope and boundary
Offline deterministic simulation core only. No UI, HTTP transport, MongoDB persistence, economy settlement, Railway worker, live spectator stream, or production race-control integration. Those are outside Phase 10.

## Engine coverage
- Qualifying and race-start order, including Race Start and Reaction attributes.
- Configurable circuit segments and lap loop.
- Tyre compound grip, temperature and nonlinear degradation.
- Weather schedule, wet performance and track-grip effects.
- DRS eligibility by configured zone and gap; ERS energy budget.
- Overtake attempt/success/failure and defensive outcome events that affect race time and classification.
- Pit windows, compound choice, service efficiency and mandatory-stop penalty.
- Mechanical condition, reliability, incidents, Safety Car and retirement.
- Classification, immutable event sequence, deterministic replay.
- Checkpoint serialization and resume with engine version, input fingerprint, RNG state, weather, race state and prior event log.
- Monte Carlo and paired sensitivity utilities.

## Phase 09 attribute contract
The engine uses the canonical 16 driver and 16 team attributes from Phase 09. Raw values are validated in [50, 200] and normalized by the CMRE formula (A - 50) / 150. All 32 attributes have effect-vector tests. Coefficients whose exact magnitudes are not specified by the CMRE Mathematical Specification remain isolated in the versioned provisional balance profile.

## Monaco reference profile
The first reference circuit is Circuit de Monaco 2026:
- Centreline: 3,337 m.
- Sector distances: 1,051 m / 1,419 m / 867 m.
- Sector split references: 60 m before Turn 5 and 70 m before Turn 13.
- 19-turn order and named landmark groups are included.
- Speed trap reference: 190 m before Turn 10.
- 2026 Overtake Mode detection/activation references are stored separately; Monaco DRS is disabled in the profile.

The sector lengths and turn/split references follow FIA event documentation. The model intentionally remains CALIBRATION_DRAFT: only three sector segments are represented, not surveyed per-corner centreline coordinates, radii, elevation samples, or exact corner reference times. The 80,000 ms lap reference and segment time allocations are neutral prototype values, not official F1 timing.

Sources:
- FIA 2026 Monaco Document 7: https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf
- FIA 2025 Monaco Circuit Map: https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_-_circuit_map_pit_lane_map_ers_battery_containment_area_red_zones.pdf
- Formula1.com Monaco corner guide: https://www.formula1.com/en/latest/article/explained-how-every-monaco-corner-got-its-name.5ClYqWmfpeUpsRJA6mDNaX

## Determinism and recovery
A checkpoint is valid only for the same race ID, engine version and canonical input fingerprint. It includes the PRNG state and complete prior event stream. Recovery resumes from the following lap. Replay validation compares classification, event stream and final PRNG state.

## Calibration gates
Run npm run race:calibrate -- --runs=1000 for 1,000 seeded full-grid Monte Carlo runs and paired controlled sensitivity comparisons. Review incident frequency, retirements, overtakes, pit losses, tyre wear, win/podium distribution and every attribute effect before treating balance as final. npm run race:benchmark measures 20/40/60-driver throughput locally; hardware-dependent results are not production capacity guarantees.

## Database and infrastructure
No database schema changed in Phase 10. Therefore no migration is required. The Phase 10 engine remains offline and does not connect to caleris_masters_dev or production. MongoDB production remains untouched. Persistent workers and live race orchestration belong to Phase 11.
