import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { COLLECTION_VALIDATORS } from "./collections.mjs";

const database = process.env.MONGODB_DB;
const uri = process.env.MONGODB_URI;
const allowProduction = process.argv.includes("--allow-production");
const migrationId = "004-teams-membership-contracts-transfer";
const definition = {
  collections: ["team_transfer_requests", "team_ownership_history"],
  indexes: [
    ["team_transfer_requests", { team_id: 1, status: 1 }],
    ["team_transfer_requests", { seller_player_id: 1, status: 1 }],
    ["team_transfer_requests", { buyer_player_id: 1, status: 1 }],
    ["team_transfer_requests", { team_id: 1 }],
    ["team_contracts", { driver_player_id: 1 }],
    ["team_ownership_history", { team_id: 1, transferred_at: 1 }],
  ],
  driverProfileExtension: ["license_tier"],
  settings: { driver_slots_per_team: 2, registration_fee_minor: { PREMIO: 25000, ZWEI: 15000 } },
};
const checksum = createHash("sha256").update(JSON.stringify(definition)).digest("hex");

if (!uri || !database) throw new Error("MONGODB_URI and MONGODB_DB are required.");
if (!database.endsWith("_dev") && !database.endsWith("_staging") && !allowProduction) {
  throw new Error("Production migration blocked; use a _dev or _staging database.");
}

const client = new MongoClient(uri, {
  maxPoolSize: 2,
  serverSelectionTimeoutMS: 10000,
  appName: "caleris-masters-phase-05-migration",
});

const uuid = {
  bsonType: "string",
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const validators = {
  team_transfer_requests: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "team_id", "seller_player_id", "buyer_player_id", "status", "seller_confirmed", "buyer_confirmed", "agreed_terms", "created_at", "updated_at"],
      properties: {
        _id: uuid, team_id: uuid, seller_player_id: uuid, buyer_player_id: uuid,
        status: { enum: ["NEGOTIATING", "SUBMITTED", "APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "COMPLETED", "CANCELLED"] },
        seller_confirmed: { bsonType: "bool" }, buyer_confirmed: { bsonType: "bool" },
        agreed_terms: { bsonType: "object" },
        review_conditions: { bsonType: "array", items: { bsonType: "string" } },
        reviewed_by: { bsonType: ["string", "null"] }, reviewed_at: { bsonType: ["date", "null"] },
        created_at: { bsonType: "date" }, updated_at: { bsonType: "date" },
      },
    },
  },
  team_ownership_history: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "team_id", "previous_owner_player_id", "new_owner_player_id", "transfer_request_id", "transferred_at", "created_at", "updated_at"],
      properties: {
        _id: uuid, team_id: uuid, previous_owner_player_id: uuid, new_owner_player_id: uuid,
        transfer_request_id: uuid, transferred_at: { bsonType: "date" },
        created_at: { bsonType: "date" }, updated_at: { bsonType: "date" },
      },
    },
  },
};

async function ensureCollection(db, names, name, validator) {
  if (names.has(name)) {
    await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  } else {
    await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    names.add(name);
  }
}

try {
  await client.connect();
  const db = client.db(database);
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const required = ["teams", "team_memberships", "team_contracts", "players", "seasons", "divisions", "economy_accounts", "ledger_transactions", "ledger_entries", "audit_logs", "schema_migrations", "game_settings"];
  for (const name of required) {
    if (!names.has(name)) throw new Error("Required baseline collection missing: " + name);
  }

  const migrations = db.collection("schema_migrations");
  const prior = await migrations.findOne({ _id: migrationId });
  if (prior) {
    if (prior.checksum !== checksum) throw new Error("Migration checksum mismatch; applied migrations are immutable.");
    console.log("Migration already applied: " + migrationId);
  } else {
    const driverValidator = structuredClone(COLLECTION_VALIDATORS.driver_profiles);
    driverValidator.$jsonSchema.properties.license_tier = { bsonType: "string", enum: ["BRONZE", "SILVER", "GOLD", "SUPER_LICENSE"] };
    await db.command({ collMod: "driver_profiles", validator: driverValidator, validationLevel: "strict", validationAction: "error" });

    for (const [name, validator] of Object.entries(validators)) {
      await ensureCollection(db, names, name, validator);
    }
    for (const [collection, keys] of definition.indexes) {
      const openTransferIndex = collection === "team_transfer_requests" && Object.keys(keys).length === 1 && keys.team_id === 1;
      const openContractIndex = collection === "team_contracts";
      const unique = openTransferIndex || openContractIndex;
      const partialFilterExpression = openTransferIndex
        ? { status: { $in: ["NEGOTIATING", "SUBMITTED"] } }
        : openContractIndex ? { status: { $in: ["OFFERED", "ACTIVE"] } } : undefined;
      await db.collection(collection).createIndex(keys, {
        name: openTransferIndex ? "uq_team_transfer_open_team" : openContractIndex ? "uq_team_contracts_open_driver" : "ix_" + collection + "_" + Object.keys(keys).join("_"),
        ...(unique ? { unique: true, partialFilterExpression } : {}),
      });
    }

    const now = new Date();
    await db.collection("game_settings").updateOne(
      { _id: "team_management_rules" },
      { $setOnInsert: { value: definition.settings, version: 1, created_at: now, updated_at: now, updated_by: "SYSTEM" } },
      { upsert: true },
    );
    await migrations.insertOne({
      _id: migrationId, checksum, applied_at: now, database,
      collection_count: 2, index_count: definition.indexes.length,
    });
    console.log("Applied Phase 05 team transfer and ownership history migration.");
  }
} finally {
  await client.close();
}
