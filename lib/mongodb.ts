import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "caleris_masters";

if (!uri) throw new Error("Missing MONGODB_URI environment variable");

type MongoGlobal = typeof globalThis & { __calerisMongoClient?: MongoClient; __calerisMongoPromise?: Promise<MongoClient> };
const globalMongo = globalThis as MongoGlobal;

export async function getMongoClient(): Promise<MongoClient> {
  if (globalMongo.__calerisMongoClient) return globalMongo.__calerisMongoClient;
  if (!globalMongo.__calerisMongoPromise) {
    const client = new MongoClient(uri, {
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
  return client.db(databaseName);
}
