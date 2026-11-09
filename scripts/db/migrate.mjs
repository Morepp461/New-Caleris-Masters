import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { DOMAIN_COLLECTIONS, INDEXES, UUID_BASELINE_VALIDATOR } from "./collections.mjs";

const databaseName = process.env.MONGODB_DB;
const uri = process.env.MONGODB_URI;
const allowProduction = process.argv.includes("--allow-production");
const migrationId = "001-domain-collections-and-indexes";
const migrationChecksum = createHash("sha256")
  .update(JSON.stringify({ DOMAIN_COLLECTIONS, INDEXES, UUID_BASELINE_VALIDATOR }))
  .digest("hex");

if (!uri) throw new Error("MONGODB_URI is required.");
if (!databaseName) throw new Error("MONGODB_DB is required.");

const isNonProduction = databaseName.endsWith("_dev") || databaseName.endsWith("_staging");
if (!isNonProduction && !allowProduction) {
  throw new Error(
    `Refusing to migrate "${databaseName}". Use a _dev or _staging database. Production requires a separately approved --allow-production invocation.`,
  );
}
if (databaseName === "caleris_masters" && !allowProduction) {
  throw new Error("Production database migration is blocked.");
}

const client = new MongoClient(uri, {
  maxPoolSize: 3,
  serverSelectionTimeoutMS: 10_000,
  appName: "caleris-masters-migrations",
});

try {
  await client.connect();
  const db = client.db(databaseName);
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existing.map((item) => item.name));

  if (!existingNames.has("schema_migrations")) {
    await db.createCollection("schema_migrations", {
      validator: UUID_BASELINE_VALIDATOR,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  await db.command({
    collMod: "schema_migrations",
    validator: UUID_BASELINE_VALIDATOR,
    validationLevel: "strict",
    validationAction: "error",
  });

  const previous = await db.collection("schema_migrations").findOne({ _id: migrationId });
  if (previous) {
    if (previous.checksum !== migrationChecksum) {
      throw new Error(`Migration checksum mismatch for ${migrationId}; never edit an applied migration.`);
    }
    console.log(`Migration already applied: ${migrationId}`);
  } else {
    for (const collectionName of DOMAIN_COLLECTIONS) {
      if (!existingNames.has(collectionName)) {
        await db.createCollection(collectionName, {
          validator: UUID_BASELINE_VALIDATOR,
          validationLevel: "strict",
          validationAction: "error",
        });
      } else {
        await db.command({
          collMod: collectionName,
          validator: UUID_BASELINE_VALIDATOR,
          validationLevel: "strict",
          validationAction: "error",
        });
      }
    }

    for (const [collectionName, indexName, definition] of INDEXES) {
      const { keys, ...options } = definition;
      await db.collection(collectionName).createIndex(keys, { ...options, name: indexName });
    }

    await db.collection("schema_migrations").insertOne({
      _id: migrationId,
      checksum: migrationChecksum,
      applied_at: new Date(),
      database: databaseName,
      collection_count: DOMAIN_COLLECTIONS.length,
      index_count: INDEXES.length,
    });
    console.log(`Applied ${migrationId}: ${DOMAIN_COLLECTIONS.length} collections, ${INDEXES.length} indexes.`);
  }
} finally {
  await client.close();
}
