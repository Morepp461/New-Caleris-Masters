import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getMongoDatabase } from "@/lib/db/mongodb";
import { getSessionPrincipal } from "@/lib/identity/session";
import { requireOperator } from "@/lib/identity/permissions";
import { apiHandler } from "@/lib/server/api-handler";
import { success } from "@/lib/server/response";
import { AppError } from "@/lib/server/errors";
import { assertSameOrigin } from "@/lib/server/csrf";
import { requireJsonObject, readString } from "@/lib/server/validation";
import { buildSeasonConfigurationSnapshot, canAmendRuleset, nextRulesetVersion, normalizeSeasonStatus, transitionEvent, transitionSeason, validateCalendarRoundCount, validateRuleset } from "@/lib/competition/policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// MongoDB documents are validated at the collection boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { _id: string; [key: string]: any };
const now = () => new Date();
const fail = (code: string, message: string, status = 409) => new AppError(code, message, status);
const audit = async (db: Awaited<ReturnType<typeof getMongoDatabase>>, actorId: string, action: string, targetType: string, targetId: string, before?: unknown, after?: unknown) => {
  await db.collection<Doc>("audit_logs").insertOne({ _id: randomUUID(), actor_type: "OPERATOR", actor_id: actorId, action, target_type: targetType, target_id: targetId, ...(before ? { before_state: before } : {}), ...(after ? { after_state: after } : {}), created_at: now(), updated_at: now() });
};
export const GET = apiHandler(async (request: NextRequest, _context, meta) => {
  const principal = await getSessionPrincipal(request); await requireOperator(principal);
  const db = await getMongoDatabase();
  const [divisions, seasons, calendars, events, championships, rulesets, circuits, entries, circuitVersions] = await Promise.all([
    db.collection<Doc>("divisions").find({}).sort({ display_order: 1, tier: 1 }).toArray(),
    db.collection<Doc>("seasons").find({}).sort({ season_number: -1 }).toArray(),
    db.collection<Doc>("race_calendars").find({}).sort({ created_at: -1 }).limit(100).toArray(),
    db.collection<Doc>("race_events").find({}).sort({ scheduled_start_at: 1 }).limit(200).toArray(),
    db.collection<Doc>("championships").find({}).sort({ season_id: 1, division_id: 1 }).toArray(),
    db.collection<Doc>("season_rulesets").find({}).sort({ season_id: 1, division_id: 1, version: -1 }).limit(200).toArray(),
    db.collection<Doc>("circuits").find({ status: "ACTIVE" }).sort({ name: 1 }).toArray(),
    db.collection<Doc>("race_entries").find({}).sort({ created_at: -1 }).limit(200).toArray(),
    db.collection<Doc>("circuit_versions").find({}).sort({ circuit_id: 1, version: -1 }).limit(200).toArray(),
  ]);
  return success({ divisions, seasons, calendars, events, championships, rulesets, circuits, entries, circuitVersions }, meta);
});
export const POST = apiHandler(async (request: NextRequest, _context, meta) => {
  assertSameOrigin(request);
  const principal = await getSessionPrincipal(request); await requireOperator(principal);
  const body = requireJsonObject(await request.json());
  const action = readString(body.action, "action", { max: 40 });
  const db = await getMongoDatabase();
  const divisions = db.collection<Doc>("divisions"), seasons = db.collection<Doc>("seasons");
  const actorId = principal!.playerId;
  if (action === "CREATE_CIRCUIT") {
    const name = readString(body.name, "name", { min: 3, max: 100 });
    const country = readString(body.country, "country", { min: 2, max: 60 });
    const city = readString(body.city, "city", { min: 2, max: 60 });
    const circuitType = readString(body.circuitType, "circuitType", { max: 30 }).toUpperCase();
    if (await db.collection<Doc>("circuits").findOne({ name })) throw fail("CIRCUIT_EXISTS", "Circuit name already exists.");
    const id = randomUUID(), stamp = now();
    await db.collection<Doc>("circuits").insertOne({ _id: id, name, country, city, circuit_type: circuitType, status: "ACTIVE", created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "CIRCUIT_CREATED", "CIRCUIT", id, undefined, { name, country, city, circuitType });
    return success({ circuitId: id }, meta, 201);
  }
  if (action === "CREATE_CIRCUIT_VERSION") {
    const circuitId = readString(body.circuitId, "circuitId", { max: 64 });
    const circuit = await db.collection<Doc>("circuits").findOne({ _id: circuitId, status: "ACTIVE" });
    if (!circuit) throw new AppError("CIRCUIT_NOT_FOUND", "Active circuit not found.", 404);
    const trackLengthMeters = Number(body.trackLengthMeters), totalCorners = Number(body.totalCorners);
    if (!Number.isSafeInteger(trackLengthMeters) || trackLengthMeters < 100 || !Number.isSafeInteger(totalCorners) || totalCorners < 1) throw new AppError("INVALID_CIRCUIT_VERSION", "Track length and corner count must be valid positive integers.", 400);
    const previous = await db.collection<Doc>("circuit_versions").find({ circuit_id: circuitId }).sort({ version: -1 }).limit(1).next();
    const id = randomUUID(), stamp = now(), version = Number(previous?.version ?? 0) + 1;
    await db.collection<Doc>("circuit_versions").insertOne({ _id: id, circuit_id: circuitId, version, track_length_meters: trackLengthMeters, total_corners: totalCorners, track_segments: Array.isArray(body.trackSegments) ? body.trackSegments : [], drs_zones: Array.isArray(body.drsZones) ? body.drsZones : [], pit_lane_data: body.pitLaneData && typeof body.pitLaneData === "object" ? body.pitLaneData : {}, track_metadata: body.trackMetadata && typeof body.trackMetadata === "object" ? body.trackMetadata : {}, created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "CIRCUIT_VERSION_CREATED", "CIRCUIT_VERSION", id, undefined, { circuitId, version, trackLengthMeters, totalCorners });
    return success({ circuitVersionId: id, version }, meta, 201);
  }
  if (action === "CREATE_DIVISION") {
    const name = readString(body.name, "name", { min: 3, max: 60 });
    const code = readString(body.code, "code", { min: 2, max: 12 }).toUpperCase();
    const tier = Number(body.tier);
    if (!Number.isSafeInteger(tier) || tier < 1 || tier > 20) throw new AppError("INVALID_TIER", "Tier must be an integer from 1 to 20.", 400);
    const existing = await divisions.findOne({ $or: [{ code }, { name: { $regex: "^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } }] });
    if (existing) throw fail("DIVISION_EXISTS", "Division code or name already exists.");
    const highest = await divisions.find({}).sort({ display_order: -1 }).limit(1).next();
    const id = randomUUID(), stamp = now();
    await divisions.insertOne({ _id: id, name, code, tier, description: "", status: "ACTIVE", display_order: Number(highest?.display_order ?? 0) + 1, created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "DIVISION_CREATED", "DIVISION", id, undefined, { name, code, tier });
    return success({ divisionId: id, status: "ACTIVE" }, meta, 201);
  }
  if (action === "UPDATE_DIVISION") {
    const divisionId = readString(body.divisionId, "divisionId", { max: 64 });
    const division = await divisions.findOne({ _id: divisionId });
    if (!division) throw new AppError("DIVISION_NOT_FOUND", "Division not found.", 404);
    if (["ARCHIVED"].includes(String(division.status))) throw fail("DIVISION_ARCHIVED", "Archived divisions cannot be edited.");
    const patch: Record<string, unknown> = { updated_at: now() };
    if (body.name !== undefined) { const nextName = readString(body.name, "name", { min: 3, max: 60 }); const duplicate = await divisions.findOne({ name: nextName, _id: { $ne: divisionId } }); if (duplicate) throw fail("DIVISION_NAME_EXISTS", "Division name already exists."); patch.name = nextName; }
    if (body.description !== undefined) patch.description = readString(body.description, "description", { min: 0, max: 500 });
    if (body.tier !== undefined) { const tier = Number(body.tier); if (!Number.isSafeInteger(tier) || tier < 1 || tier > 20) throw new AppError("INVALID_TIER", "Tier must be an integer from 1 to 20.", 400); patch.tier = tier; }
    if (body.displayOrder !== undefined) { const order = Number(body.displayOrder); if (!Number.isSafeInteger(order) || order < 1) throw new AppError("INVALID_DISPLAY_ORDER", "Display order must be a positive integer.", 400); patch.display_order = order; }
    if (body.status !== undefined) { const status = readString(body.status, "status", { max: 20 }).toUpperCase(); if (!["ACTIVE", "INACTIVE"].includes(status)) throw new AppError("INVALID_DIVISION_STATUS", "Division status must be ACTIVE or INACTIVE.", 400); if (status === "INACTIVE" && await db.collection<Doc>("teams").findOne({ division_id: divisionId, status: "ACTIVE" })) throw fail("DIVISION_HAS_ACTIVE_TEAMS", "A division with active teams cannot be deactivated."); patch.status = status; }
    await divisions.updateOne({ _id: divisionId }, { $set: patch });
    await audit(db, actorId, "DIVISION_UPDATED", "DIVISION", divisionId, { status: division.status, tier: division.tier, display_order: division.display_order }, patch);
    return success({ divisionId, updated: true }, meta);
  }
  if (action === "ARCHIVE_DIVISION") {
    const divisionId = readString(body.divisionId, "divisionId", { max: 64 });
    const division = await divisions.findOne({ _id: divisionId });
    if (!division) throw new AppError("DIVISION_NOT_FOUND", "Division not found.", 404);
    const activeSeasons = await db.collection<Doc>("seasons").find({ status: { $in: ["PLANNED", "REGISTRATION", "ACTIVE"] } }, { projection: { _id: 1 } }).toArray();
    const activeSeasonIds = activeSeasons.map((item) => item._id);
    const [activeTeams, activeSeason, activeEvents] = await Promise.all([db.collection<Doc>("teams").findOne({ division_id: divisionId, status: "ACTIVE" }), db.collection<Doc>("season_rulesets").findOne({ division_id: divisionId, season_id: { $in: activeSeasonIds }, status: "LOCKED" }), db.collection<Doc>("race_events").findOne({ division_id: divisionId, status: { $in: ["SCHEDULED", "REGISTRATION_LOCKED", "READY", "RUNNING"] } })]);
    if (activeTeams || activeSeason || activeEvents) throw fail("DIVISION_IN_USE", "Division has active teams, locked regulations or open race events.");
    await divisions.updateOne({ _id: divisionId }, { $set: { status: "ARCHIVED", updated_at: now() } });
    await audit(db, actorId, "DIVISION_ARCHIVED", "DIVISION", divisionId, { status: division.status }, { status: "ARCHIVED" });
    return success({ divisionId, status: "ARCHIVED" }, meta);
  }
  if (action === "CREATE_SEASON") {
    const name = readString(body.name, "name", { min: 2, max: 60 }), seasonNumber = Number(body.seasonNumber);
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) throw new AppError("INVALID_SEASON_NUMBER", "Season number must be a positive integer.", 400);
    if (await seasons.findOne({ season_number: seasonNumber })) throw fail("SEASON_EXISTS", "Season number already exists.");
    const id = randomUUID(), stamp = now();
    await seasons.insertOne({ _id: id, season_number: seasonNumber, name, status: "PLANNED", created_by: actorId, created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "SEASON_CREATED", "SEASON", id, undefined, { seasonNumber, name });
    return success({ seasonId: id, status: "PLANNED" }, meta, 201);
  }
  if (action === "TRANSITION_SEASON") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 }), target = readString(body.status, "status", { max: 24 }).toUpperCase();
    const season = await seasons.findOne({ _id: seasonId }); if (!season) throw new AppError("SEASON_NOT_FOUND", "Season not found.", 404);
    const current = normalizeSeasonStatus(String(season.status));
    const decision = transitionSeason(current, target); if (!decision.ok) throw fail(decision.reason!, "Invalid season lifecycle transition.");
    let configurationSnapshot: Record<string, unknown> | undefined;
    if (target === "ACTIVE") {
      const participating = await db.collection<Doc>("season_rulesets").find({ season_id: seasonId, status: "LOCKED" }).toArray();
      const calendars = await db.collection<Doc>("race_calendars").find({ season_id: seasonId, status: "ACTIVE" }).toArray();
      if (!participating.length || !calendars.length) throw fail("SEASON_SETUP_INCOMPLETE", "Activation requires locked division rulesets and active calendars.");
      const divisionIds = [...new Set(participating.map((item) => String(item.division_id)))];
      if (calendars.some((item) => !divisionIds.includes(String(item.division_id)))) throw fail("SEASON_SETUP_INCOMPLETE", "Every participating calendar must have a locked ruleset.");
      const calendarIds = calendars.map((item) => item._id);
      const events = await db.collection<Doc>("race_events").find({ calendar_id: { $in: calendarIds } }).sort({ calendar_id: 1, round_number: 1 }).toArray();
      for (const calendar of calendars) {
        const rounds = events.filter((item) => item.calendar_id === calendar._id);
        if (rounds.length !== Number(calendar.total_rounds)) throw fail("SEASON_CALENDAR_INCOMPLETE", "Every calendar must contain exactly its configured number of race events.");
      }
      const [divisionRecords, teams] = await Promise.all([
        db.collection<Doc>("divisions").find({ _id: { $in: divisionIds } }).toArray(),
        db.collection<Doc>("teams").find({ division_id: { $in: divisionIds }, status: "ACTIVE" }).toArray(),
      ]);
      const teamIds = teams.map((item) => item._id);
      const drivers = teamIds.length
        ? await db.collection<Doc>("driver_profiles").find({ active_team_id: { $in: teamIds }, profile_status: "ACTIVE" }).toArray()
        : [];
      const eventIds = events.map((item) => item._id);
      const entries = eventIds.length
        ? await db.collection<Doc>("race_entries").find({ race_event_id: { $in: eventIds } }).toArray()
        : [];
      configurationSnapshot = buildSeasonConfigurationSnapshot({
        divisions: divisionRecords,
        calendars,
        rulesets: participating,
        teams,
        drivers,
        events,
        entries,
      });
    }
    const stamp = now();
    await seasons.updateOne({ _id: seasonId, status: season.status }, { $set: { status: target, ...(target === "ACTIVE" ? { activated_at: stamp, start_date: stamp, configuration_snapshot: configurationSnapshot, configuration_snapshot_created_at: stamp } : {}), ...(target === "COMPLETED" || target === "ARCHIVED" ? { closed_at: stamp, end_date: stamp } : {}), updated_at: stamp } });
    await audit(db, actorId, "SEASON_STATUS_CHANGED", "SEASON", seasonId, { status: season.status }, { status: target });
    return success({ seasonId, status: target }, meta);
  }
  if (action === "CREATE_RULESET" || action === "AMEND_RULESET") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 }), divisionId = readString(body.divisionId, "divisionId", { max: 64 });
    const season = await seasons.findOne({ _id: seasonId }); const division = await divisions.findOne({ _id: divisionId, status: { $ne: "ARCHIVED" } });
    if (!season || !division) throw new AppError("COMPETITION_REFERENCE_NOT_FOUND", "Season or division was not found.", 404);
    if (["COMPLETED", "ARCHIVED", "CANCELLED"].includes(String(season.status))) throw fail("SEASON_CLOSED", "Closed seasons cannot receive new rulesets.");
    const rules = { calendar_rules: body.calendarRules, scoring_rules: body.scoringRules, penalty_rules: body.penaltyRules, race_rules: body.raceRules, economy_rules: body.economyRules, eligibility_rules: body.eligibilityRules };
    const validation = validateRuleset(rules); if (!validation.ok) throw new AppError(validation.reason!, "Ruleset configuration is incomplete or invalid.", 400);
    const previous = await db.collection<Doc>("season_rulesets").find({ season_id: seasonId, division_id: divisionId }).sort({ version: -1 }).toArray();
    if (action === "AMEND_RULESET" && !previous.length) throw fail("RULESET_NOT_FOUND", "There is no ruleset to amend.", 404);
    if (action === "CREATE_RULESET" && previous.length) throw fail("RULESET_EXISTS", "Use amendment to create a new ruleset version.");
    if (action === "AMEND_RULESET" && !canAmendRuleset(String(previous[0].status))) throw fail("RULESET_NOT_LOCKED", "Only locked or active rulesets can be amended.");
    const id = randomUUID(), stamp = now(), version = nextRulesetVersion(previous);
    await db.collection<Doc>("season_rulesets").insertOne({ _id: id, season_id: seasonId, division_id: divisionId, version, status: "DRAFT", ...rules, created_by: actorId, created_at: stamp, updated_at: stamp, ...(previous[0] ? { amends_ruleset_id: previous[0]._id } : {}) });
    await audit(db, actorId, action === "AMEND_RULESET" ? "RULESET_AMENDMENT_CREATED" : "RULESET_CREATED", "SEASON_RULESET", id, previous[0] ? { rulesetId: previous[0]._id, version: previous[0].version } : undefined, { version, seasonId, divisionId });
    return success({ rulesetId: id, version, status: "DRAFT" }, meta, 201);
  }
  if (action === "UPDATE_RULESET") {
    const rulesetId = readString(body.rulesetId, "rulesetId", { max: 64 });
    const rules = { calendar_rules: body.calendarRules, scoring_rules: body.scoringRules, penalty_rules: body.penaltyRules, race_rules: body.raceRules, economy_rules: body.economyRules, eligibility_rules: body.eligibilityRules };
    const validation = validateRuleset(rules); if (!validation.ok) throw new AppError(validation.reason!, "Ruleset configuration is incomplete or invalid.", 400);
    const draft = await db.collection<Doc>("season_rulesets").findOne({ _id: rulesetId, status: "DRAFT" });
    if (!draft) throw fail("RULESET_NOT_DRAFT", "Only a draft ruleset can be edited.");
    await db.collection<Doc>("season_rulesets").updateOne({ _id: rulesetId, status: "DRAFT" }, { $set: { ...rules, updated_at: now() } });
    await audit(db, actorId, "RULESET_DRAFT_UPDATED", "SEASON_RULESET", rulesetId, { status: "DRAFT" }, { updated: true });
    return success({ rulesetId, updated: true }, meta);
  }
  if (action === "LOCK_RULESET") {
    const rulesetId = readString(body.rulesetId, "rulesetId", { max: 64 });
    const ruleset = await db.collection<Doc>("season_rulesets").findOne({ _id: rulesetId, status: "DRAFT" });
    if (!ruleset) throw fail("RULESET_NOT_DRAFT", "Only a draft ruleset can be approved and locked.");
    const [season, division] = await Promise.all([seasons.findOne({ _id: ruleset.season_id }), divisions.findOne({ _id: ruleset.division_id, status: { $ne: "ARCHIVED" } })]);
    if (!season || !division || ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(String(season.status))) throw fail("RULESET_SCOPE_CLOSED", "Ruleset scope is not available.");
    await db.collection<Doc>("season_rulesets").updateOne({ _id: rulesetId, status: "DRAFT" }, { $set: { status: "LOCKED", approved_by: actorId, approved_at: now(), updated_at: now() } });
    await db.collection<Doc>("race_calendars").updateMany({ season_id: ruleset.season_id, division_id: ruleset.division_id, status: { $in: ["DRAFT", "ACTIVE"] } }, { $set: { ruleset_id: rulesetId, updated_at: now() } });
    await audit(db, actorId, "RULESET_LOCKED", "SEASON_RULESET", rulesetId, { status: "DRAFT" }, { status: "LOCKED" });
    return success({ rulesetId, status: "LOCKED" }, meta);
  }
  if (action === "CREATE_CALENDAR") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 }), divisionId = readString(body.divisionId, "divisionId", { max: 64 }), totalRounds = Number(body.totalRounds);
    if (!validateCalendarRoundCount(totalRounds)) throw new AppError("INVALID_ROUND_COUNT", "Total rounds must be an integer between 1 and 100.", 400);
    const [season, division, ruleset] = await Promise.all([seasons.findOne({ _id: seasonId }), divisions.findOne({ _id: divisionId, status: "ACTIVE" }), db.collection<Doc>("season_rulesets").findOne({ season_id: seasonId, division_id: divisionId, status: "LOCKED" }, { sort: { version: -1 } })]);
    if (!season || !["PLANNED", "REGISTRATION"].includes(String(season.status)) || !division || !ruleset) throw fail("CALENDAR_SETUP_INCOMPLETE", "A planned/registration season, active division and locked ruleset are required.");
    if (await db.collection<Doc>("race_calendars").findOne({ season_id: seasonId, division_id: divisionId })) throw fail("CALENDAR_EXISTS", "A calendar already exists for this season and division.");
    const id = randomUUID(), stamp = now();
    await db.collection<Doc>("race_calendars").insertOne({ _id: id, season_id: seasonId, division_id: divisionId, status: "DRAFT", total_rounds: totalRounds, ruleset_id: ruleset._id, created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "RACE_CALENDAR_CREATED", "RACE_CALENDAR", id, undefined, { seasonId, divisionId, totalRounds });
    return success({ calendarId: id, status: "DRAFT" }, meta, 201);
  }
  if (action === "ACTIVATE_CALENDAR") {
    const calendarId = readString(body.calendarId, "calendarId", { max: 64 });
    const calendar = await db.collection<Doc>("race_calendars").findOne({ _id: calendarId, status: "DRAFT" });
    if (!calendar) throw fail("CALENDAR_NOT_DRAFT", "Only a draft calendar can be activated.");
    const [season, ruleset, eventCount] = await Promise.all([seasons.findOne({ _id: calendar.season_id, status: { $in: ["PLANNED", "REGISTRATION"] } }), db.collection<Doc>("season_rulesets").findOne({ _id: calendar.ruleset_id, status: "LOCKED" }), db.collection<Doc>("race_events").countDocuments({ calendar_id: calendarId })]);
    if (!season || !ruleset || eventCount !== Number(calendar.total_rounds)) throw fail("CALENDAR_SETUP_INCOMPLETE", "Calendar requires an open season, locked ruleset and one scheduled event for every round.");
    await db.collection<Doc>("race_calendars").updateOne({ _id: calendarId, status: "DRAFT" }, { $set: { status: "ACTIVE", activated_at: now(), updated_at: now() } });
    await audit(db, actorId, "RACE_CALENDAR_ACTIVATED", "RACE_CALENDAR", calendarId, { status: "DRAFT" }, { status: "ACTIVE" });
    return success({ calendarId, status: "ACTIVE" }, meta);
  }
  if (action === "CREATE_EVENT") {
    const calendarId = readString(body.calendarId, "calendarId", { max: 64 }), circuitId = readString(body.circuitId, "circuitId", { max: 64 }), circuitVersionId = readString(body.circuitVersionId, "circuitVersionId", { max: 64 });
    const roundNumber = Number(body.roundNumber), totalLaps = Number(body.totalLaps), raceFormat = readString(body.raceFormat, "raceFormat", { max: 24 }).toUpperCase(), scheduledStartAt = new Date(String(body.scheduledStartAt));
    if (!Number.isSafeInteger(roundNumber) || roundNumber < 1 || !Number.isSafeInteger(totalLaps) || totalLaps < 1 || Number.isNaN(scheduledStartAt.getTime()) || !["FEATURE", "SPRINT", "ENDURANCE", "TIME_TRIAL"].includes(raceFormat)) throw new AppError("INVALID_EVENT_CONFIGURATION", "Round, laps, race format and scheduled start must be valid.", 400);
    const calendar = await db.collection<Doc>("race_calendars").findOne({ _id: calendarId, status: "ACTIVE" });
    if (!calendar || roundNumber > Number(calendar.total_rounds)) throw fail("CALENDAR_NOT_AVAILABLE", "Calendar is unavailable or round exceeds configured rounds.");
    const [circuit, circuitVersion, ruleset] = await Promise.all([db.collection<Doc>("circuits").findOne({ _id: circuitId, status: "ACTIVE" }), db.collection<Doc>("circuit_versions").findOne({ _id: circuitVersionId, circuit_id: circuitId }), db.collection<Doc>("season_rulesets").findOne({ _id: calendar.ruleset_id, status: "LOCKED" })]);
    if (!circuit || !circuitVersion || !ruleset) throw fail("EVENT_REFERENCE_INVALID", "Circuit, circuit version or locked ruleset is invalid.");
    const id = randomUUID(), stamp = now();
    await db.collection<Doc>("race_events").insertOne({ _id: id, season_id: calendar.season_id, division_id: calendar.division_id, calendar_id: calendarId, circuit_id: circuitId, circuit_version_id: circuitVersionId, race_format: raceFormat, scoring_ruleset_id: ruleset._id, status: "SCHEDULED", round_number: roundNumber, total_laps: totalLaps, scheduled_start_at: scheduledStartAt, weather_configuration: body.weatherConfiguration ?? {}, tyre_rules: body.tyreRules ?? {}, pit_rules: body.pitRules ?? {}, created_at: stamp, updated_at: stamp });
    await audit(db, actorId, "RACE_EVENT_CREATED", "RACE_EVENT", id, undefined, { calendarId, roundNumber, circuitId });
    return success({ raceEventId: id, status: "SCHEDULED" }, meta, 201);
  }
  if (action === "TRANSITION_EVENT") {
    const eventId = readString(body.eventId, "eventId", { max: 64 }), target = readString(body.status, "status", { max: 24 }).toUpperCase();
    const event = await db.collection<Doc>("race_events").findOne({ _id: eventId }); if (!event) throw new AppError("RACE_EVENT_NOT_FOUND", "Race event not found.", 404);
    const decision = transitionEvent(String(event.status), target); if (!decision.ok) throw fail(decision.reason!, "Invalid race event lifecycle transition.");
    await db.collection<Doc>("race_events").updateOne({ _id: eventId, status: event.status }, { $set: { status: target, updated_at: now() } });
    await audit(db, actorId, "RACE_EVENT_STATUS_CHANGED", "RACE_EVENT", eventId, { status: event.status }, { status: target });
    return success({ eventId, status: target }, meta);
  }
  if (action === "CREATE_CHAMPIONSHIPS") {
    const seasonId = readString(body.seasonId, "seasonId", { max: 64 }), divisionId = readString(body.divisionId, "divisionId", { max: 64 });
    const ruleset = await db.collection<Doc>("season_rulesets").findOne({ season_id: seasonId, division_id: divisionId, status: "LOCKED" }, { sort: { version: -1 } });
    if (!ruleset) throw fail("LOCKED_RULESET_REQUIRED", "Championships require a locked division ruleset.");
    const ids: string[] = [];
    for (const type of ["DRIVERS", "TEAMS"]) {
      const existing = await db.collection<Doc>("championships").findOne({ season_id: seasonId, division_id: divisionId, championship_type: type });
      if (!existing) { const id = randomUUID(); await db.collection<Doc>("championships").insertOne({ _id: id, season_id: seasonId, division_id: divisionId, championship_type: type, ruleset_id: ruleset._id, status: "ACTIVE", created_at: now(), updated_at: now() }); ids.push(id); }
      else ids.push(existing._id);
    }
    await audit(db, actorId, "CHAMPIONSHIPS_CONFIGURED", "SEASON_DIVISION", seasonId + ":" + divisionId, undefined, { championshipIds: ids });
    return success({ championshipIds: ids }, meta, 201);
  }
  if (action === "CREATE_ENTRY") {
    const eventId = readString(body.eventId, "eventId", { max: 64 }), playerId = readString(body.playerId, "playerId", { max: 64 }), teamId = readString(body.teamId, "teamId", { max: 64 }), driverProfileId = readString(body.driverProfileId, "driverProfileId", { max: 64 });
    const event = await db.collection<Doc>("race_events").findOne({ _id: eventId, status: "SCHEDULED" });
    if (!event) throw fail("ENTRY_REGISTRATION_CLOSED", "Race event is not accepting entries.");
    const [player, team, profile] = await Promise.all([db.collection<Doc>("players").findOne({ _id: playerId, account_status: "ACTIVE" }), db.collection<Doc>("teams").findOne({ _id: teamId, division_id: event.division_id, status: "ACTIVE" }), db.collection<Doc>("driver_profiles").findOne({ _id: driverProfileId, player_id: playerId, active_team_id: teamId, active_division_id: event.division_id, profile_status: "ACTIVE" })]);
    if (!player || !team || !profile) throw fail("ENTRY_ELIGIBILITY_FAILED", "Player, team and driver profile must be active and aligned to this division.");
    const id = randomUUID();
    try { await db.collection<Doc>("race_entries").insertOne({ _id: id, race_event_id: eventId, player_id: playerId, team_id: teamId, driver_profile_id: driverProfileId, eligibility_status: "ELIGIBLE", car_configuration: {}, created_at: now(), updated_at: now() }); }
    catch (error) { if ((error as { code?: number }).code === 11000) throw fail("DUPLICATE_RACE_ENTRY", "Driver is already registered for this race."); throw error; }
    await audit(db, actorId, "RACE_ENTRY_CREATED", "RACE_ENTRY", id, undefined, { eventId, playerId, teamId });
    return success({ entryId: id, status: "ELIGIBLE" }, meta, 201);
  }
  throw new AppError("UNKNOWN_COMPETITION_ACTION", "Unsupported competition action.", 400);
}, { scope: "operator-competition" });
