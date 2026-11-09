import { MongoClient, type Db } from "mongodb";

function getMongoUri(): string {
  const value = process.env.MONGODB_URI;
  if (!value) throw new Error("Missing MONGODB_URI environment variable");
  return value;
}
const databaseName = process.env.MONGODB_DB ?? "caleris_masters";

type MongoGlobal = typeof globalThis & {
  __calerisMongoClient?: MongoClient;
  __calerisMongoPromise?: Promise<MongoClient>;
  __calerisMongoIndexes?: Promise<void>;
};
const globalMongo = globalThis as MongoGlobal;

export async function getMongoClient(): Promise<MongoClient> {
  if (globalMongo.__calerisMongoClient) return globalMongo.__calerisMongoClient;
  if (!globalMongo.__calerisMongoPromise) {
    const client = new MongoClient(getMongoUri(), {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
    });
    globalMongo.__calerisMongoPromise = client.connect();
  }
  const client = await globalMongo.__calerisMongoPromise;
  globalMongo.__calerisMongoClient = client;
  return client;
}

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(databaseName);
  if (!globalMongo.__calerisMongoIndexes) {
    globalMongo.__calerisMongoIndexes = Promise.all([
      db.collection("admin_users").createIndex({ email: 1 }, { unique: true, name: "admin_users_email_unique" }),
      db.collection("admin_sessions").createIndex({ tokenHash: 1 }, { unique: true, name: "admin_sessions_token_hash_unique" }),
      db.collection("admin_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_sessions_expiry_ttl" }),
      db.collection("admin_sheet_records").createIndex({ sheet_key: 1, sort_order: 1, created_at: -1 }, { name: "admin_sheet_records_sheet_order" }),
      db.collection("audit_logs").createIndex({ created_at: -1 }, { name: "audit_logs_created_at" }),
    ]).then(() => undefined).catch((error) => {
      globalMongo.__calerisMongoIndexes = undefined;
      throw error;
    });
  }
  await globalMongo.__calerisMongoIndexes;
  return db;
}
