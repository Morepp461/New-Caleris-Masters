import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  __calerisMongoClientPromise?: Promise<MongoClient>;
};

/**
 * Server-side MongoDB connection lifecycle.
 * Do not import this module from Client Components.
 * The connection is lazy: importing application code or building the public
 * landing page does not require production credentials.
 */
export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured for this environment.");
  }

  if (!globalForMongo.__calerisMongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
      appName: "caleris-masters",
    });

    globalForMongo.__calerisMongoClientPromise = client.connect().catch((error: unknown) => {
      globalForMongo.__calerisMongoClientPromise = undefined;
      throw error;
    });
  }

  return globalForMongo.__calerisMongoClientPromise;
}

export async function getMongoDatabase(): Promise<Db> {
  const databaseName = process.env.MONGODB_DB;

  if (!databaseName) {
    throw new Error("MONGODB_DB is not configured for this environment.");
  }

  const client = await getMongoClient();
  return client.db(databaseName);
}
