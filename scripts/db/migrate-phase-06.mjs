import { createHash, randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const database = process.env.MONGODB_DB;
const uri = process.env.MONGODB_URI;
const allowProduction = process.argv.includes("--allow-production");
const migrationId = "005-divisions-seasons-competition";
const definition = {
  seededDivisions: [
    { code: "PREMIO", name: "Caleris Premio", tier: 1, display_order: 1 },
    { code: "ZWEI", name: "Caleris Zwei", tier: 2, display_order: 2 },
  ],
  indexes: [
    ["season_rulesets", { season_id: 1, division_id: 1, version: 1 }, { unique: true, name: "uq_ruleset_season_division_version" }],
    ["race_calendars", { season_id: 1, division_id: 1 }, { unique: true, name: "uq_calendar_season_division" }],
    ["race_calendars", { status: 1, season_id: 1 }, { name: "ix_calendar_status_season" }],
    ["championships", { season_id: 1, division_id: 1, championship_type: 1 }, { unique: true, name: "uq_championship_season_division_type" }],
    ["championship_standings", { championship_id: 1, participant_type: 1, participant_id: 1 }, { unique: true, name: "uq_standing_championship_participant" }],\n    ["circuit_versions", { circuit_id: 1, version: 1 }, { unique: true, name: "uq_circuit_version_number" }],
    ["race_entries", { race_event_id: 1, player_id: 1 }, { unique: true, name: "uq_race_entry_event_player" }],
  ],
};
const checksum = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
if (!uri || !database) throw new Error("MONGODB_URI and MONGODB_DB are required.");
if (!database.endsWith("_dev") && !database.endsWith("_staging") && !allowProduction) {
  throw new Error("Production migration blocked; use a _dev or _staging database.");
}
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000, appName: "caleris-masters-phase-06-migration" });
try {
  await client.connect();
  const db = client.db(database);
  const required = ["divisions", "seasons", "season_rulesets", "race_calendars", "race_events", "race_entries", "championships", "championship_standings", "season_snapshots", "schema_migrations", "audit_logs"];
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  for (const name of required) if (!names.has(name)) throw new Error("Required baseline collection missing: " + name);
  const migrations = db.collection("schema_migrations");
  const previous = await migrations.findOne({ _id: migrationId });
  if (previous) {
    if (previous.checksum !== checksum) throw new Error("Migration checksum mismatch; applied migrations are immutable.");
    console.log("Migration already applied: " + migrationId);
  } else {
    for (const [collection, keys, options] of definition.indexes) {
      await db.collection(collection).createIndex(keys, options);
    }
    const now = new Date();
    for (const division of definition.seededDivisions) {
      await db.collection("divisions").updateOne(
        { code: division.code },
        { $setOnInsert: { _id: randomUUID(), ...division, description: division.code === "PREMIO" ? "Top-tier Caleris competition." : "Second-tier Caleris competition.", status: "ACTIVE", created_at: now, updated_at: now } },
        { upsert: true },
      );
    }
    await migrations.insertOne({ _id: migrationId, checksum, applied_at: now, database, collection_count: 0, index_count: definition.indexes.length, seeded_division_count: definition.seededDivisions.length });
    console.log("Applied Phase 06 divisions, seasons and competition migration.");
  }
} finally {
  await client.close();
}
