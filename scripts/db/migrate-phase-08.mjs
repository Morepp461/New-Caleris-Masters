import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { COLLECTION_VALIDATORS } from "./collections.mjs";
const database = process.env.MONGODB_DB, uri = process.env.MONGODB_URI, allowProduction = process.argv.includes("--allow-production");
const migrationId = "007-economy-currency-development-wallets";
const definition = { indexes: [
  ["ledger_transactions", { created_at: -1, status: 1 }, { name: "ix_ledger_transactions_created_status" }],
  ["ledger_transactions", { category: 1, created_at: -1 }, { name: "ix_ledger_transactions_category_date" }],
  ["ledger_entries", { transaction_id: 1, account_id: 1, direction: 1 }, { unique: true, name: "uq_ledger_entry_transaction_account_direction" }],
  ["development_transactions", { idempotency_key: 1 }, { unique: true, name: "uq_development_transactions_idempotency" }],
  ["development_transactions", { owner_type: 1, owner_id: 1, token_type: 1, created_at: -1 }, { name: "ix_development_transactions_owner_token_date" }],
  ["economy_rulesets", { season_id: 1, version: 1 }, { unique: true, name: "uq_economy_rulesets_season_version" }],
  ["economy_rulesets", { season_id: 1, status: 1, version: -1 }, { name: "ix_economy_rulesets_season_status_version" }],
  ["economy_periods", { season_id: 1, period_number: 1 }, { unique: true, name: "uq_economy_periods_season_period" }],
  ["economy_periods", { status: 1, start_at: 1 }, { name: "ix_economy_periods_status_start" }],
  ["loans", { team_id: 1, status: 1, created_at: -1 }, { name: "ix_loans_team_status_date" }],
] };
const checksum = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
if (!uri || !database) throw new Error("MONGODB_URI and MONGODB_DB are required.");
if (!database.endsWith("_dev") && !database.endsWith("_staging") && !allowProduction) throw new Error("Production migration blocked; use a _dev or _staging database.");
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000, appName: "caleris-masters-phase-08-migration" });
try {
  await client.connect();
  const db = client.db(database), required = ["economy_accounts","ledger_transactions","ledger_entries","economy_rulesets","economy_periods","loans","development_wallets","development_transactions","schema_migrations","audit_logs"];
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  for (const name of required) if (!names.has(name)) throw new Error("Required baseline collection missing: " + name);
  const migrations = db.collection("schema_migrations"), prior = await migrations.findOne({ _id: migrationId });
  if (prior) {
    if (prior.checksum !== checksum) throw new Error("Migration checksum mismatch; applied migrations are immutable.");
    console.log("Migration already applied: " + migrationId);
  } else {
    const validator = structuredClone(COLLECTION_VALIDATORS.development_transactions);
    Object.assign(validator.$jsonSchema.properties, { idempotency_key: { bsonType: "string", minLength: 8, maxLength: 160 }, actor_id: { bsonType: "string" }, reason: { bsonType: "string", minLength: 8, maxLength: 500 }, ruleset_version: { bsonType: ["int", "long", "null"] } });
    await db.command({ collMod: "development_transactions", validator, validationLevel: "strict", validationAction: "error" });
    for (const [collection, keys, options] of definition.indexes) await db.collection(collection).createIndex(keys, options);
    await migrations.insertOne({ _id: migrationId, checksum, applied_at: new Date(), database, collection_count: 0, index_count: definition.indexes.length, seeds_created: 0 });
    console.log("Applied Phase 08 economy ledger and wallet indexes: " + definition.indexes.length + ".");
  }
} finally { await client.close(); }
