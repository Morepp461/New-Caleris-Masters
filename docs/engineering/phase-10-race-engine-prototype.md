# Phase 10 — Race Engine Prototype

## Scope and safety boundaries
Offline TypeScript simulation library only. Not connected to player-facing routes, rewards, economy, Vercel request handlers, or Railway workers. No database adapter or migration is introduced.

## Engine contract
- CMRE version: CMRE-1.0.0-prototype.
- Deterministic seed is mandatory.
- Canonical attributes are validated in range 50–200 and normalized with N(A) = (A - 50) / 150.
- Circuit segment lengths and reference times must sum to circuit totals.
- Event sequence and per-lap checkpoints are emitted.
- Grid size, lap count, weather, compounds, pit, DRS, ERS, incident and performance-cap settings are configurable.

## Formula coverage in this increment
Driver/team segment pace and cap; qualifying pace; wet, adaptability and pressure context; tyre degradation/grip; weather segment penalty; overtake/defense probabilities; DRS/ERS; pit-stop time; focus/consistency incident modifiers; mechanical sympathy/reliability; event log, checkpoint serialization and deterministic replay.

## Outstanding validation and calibration
Monaco geometry is not embedded as a validated circuit dataset. Public track length/turn count do not establish per-segment lengths, reference times, sensitivity factors, braking, tyre stress, overtake difficulty or incident risk. Do not fabricate these values. Circuit profile remains CALIBRATION_DRAFT until sourced data is verified.
Safety Car, complete race-start launch resolution, full strategy candidate evaluation, steward/penalty model, component-specific failure modes, RNG-state checkpoint recovery, Monte Carlo distribution and full 32-attribute sensitivity reports remain outstanding. This increment is the engine foundation, not Phase 10 Definition of Done.

## Database
No migration or seed is introduced. Existing circuit/race collections remain untouched. Any future adapter must explicitly target caleris_masters_dev. Production database is out of scope.
