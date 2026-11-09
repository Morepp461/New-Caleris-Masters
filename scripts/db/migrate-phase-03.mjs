import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";

const databaseName = process.env.MONGODB_DB;
const uri = process.env.MONGODB_URI;
const allowProduction = process.argv.includes("--allow-production");
const migrationId = "002-identity-session-and-security-audit";
const migrationDefinition = {
  collection: "player_sessions",
  indexes: [
    ["uq_player_sessions_token_hash", { session_token_hash: 1 }, { unique: true }],
    ["ix_player_sessions_player_status_expiry", { player_id: 1, status: 1, expires_at: 1 }, {}],
  ],
  authAccountIndex: ["uq_auth_accounts_provider_player", { provider: 1, player_id: 1 }, { unique: true, partialFilterExpression: { provider: "discord" } }],
  auditIndex: ["ix_audit_logs_action_created", { action: 1, created_at: 1 }],
};
const checksum = createHash("sha256").update(JSON.stringify(migrationDefinition)).digest("hex");

if (!uri || !databaseName) throw new Error("MONGODB_URI and MONGODB_DB are required.");
const isNonProduction = databaseName.endsWith("_dev") || databaseName.endsWith("_staging");
if (!isNonProduction && !allowProduction) {
  throw new Error(`Refusing to migrate "${databaseName}". Use a _dev or _staging database.`);
}
if (databaseName === "caleris_masters" && !allowProduction) {
  throw new Error("Production database migration is blocked.");
}

const client = new MongoClient(uri, {
  maxPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
  appName: "caleris-masters-phase-03-migration",
});

try {
  await client.connect();
  const db = client.db(databaseName);
  const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  if (!collections.has("player_sessions") || !collections.has("audit_logs") || !collections.has("schema_migrations")) {
    throw new Error("Phase 01 baseline collections are missing; apply the approved Phase 01 migration first.");
  }

  const migrations = db.collection("schema_migrations");
  const previous = await migrations.findOne({ _id: migrationId });
  if (previous) {
    if (previous.checksum !== checksum) throw new Error(`Migration checksum mismatch for ${migrationId}; never edit an applied migration.`);
    console.log(`Migration already applied: ${migrationId}`);
  } else {
    await db.command({
      collMod: "player_sessions",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: [
            "_id", "player_id", "auth_account_id", "provider", "provider_user_id",
            "session_token_hash", "status", "issued_at", "expires_at", "last_seen_at",
            "created_at", "updated_at",
          ],
          properties: {
            _id: { bsonType: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" },
            player_id: { bsonType: "string" },
            auth_account_id: { bsonType: "string" },
            provider: { enum: ["discord"] },
            provider_user_id: { bsonType: "string" },
            session_token_hash: { bsonType: "string", pattern: "^[0-9a-f]{64}$" },
            status: { enum: ["ACTIVE", "REVOKED"] },
            issued_at: { bsonType: "date" },
            expires_at: { bsonType: "date" },
            last_seen_at: { bsonType: "date" },
            revoked_at: { bsonType: ["date", "null"] },
            revocation_reason: { bsonType: ["string", "null"] },
            ip_hash: { bsonType: ["string", "null"] },
            user_agent_hash: { bsonType: ["string", "null"] },
            created_at: { bsonType: "date" },
            updated_at: { bsonType: "date" },
          },
        },
      },
      validationLevel: "strict",
      validationAction: "error",
    });

    const sessions = db.collection("player_sessions");
    await sessions.createIndex({ session_token_hash: 1 }, { name: "uq_player_sessions_token_hash", unique: true });
    await sessions.createIndex({ player_id: 1, status: 1, expires_at: 1 }, { name: "ix_player_sessions_player_status_expiry" });
    await db.collection("auth_accounts").createIndex(
      { provider: 1, player_id: 1 },
      { name: "uq_auth_accounts_provider_player", unique: true, partialFilterExpression: { provider: "discord" } },
    );
    await db.collection("audit_logs").createIndex({ action: 1, created_at: 1 }, { name: "ix_audit_logs_action_created" });

    await migrations.insertOne({
      _id: migrationId,
      checksum,
      applied_at: new Date(),
      database: databaseName,
      collection_count: 0,
      index_count: 4,
    });
    console.log(`Applied ${migrationId}: session validator and 4 indexes.`);
  }
} finally {
  await client.close();
}
