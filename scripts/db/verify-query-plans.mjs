import { MongoClient } from "mongodb";
import { QUERY_PLAN_CASES } from "./query-plan-catalog.mjs";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
if (!uri || !databaseName) {
  throw new Error("MONGODB_URI and MONGODB_DB are required to verify query plans.");
}

function collectIndexNames(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (typeof node.indexName === "string") result.push(node.indexName);
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectIndexNames(value, result);
  }
  return result;
}

const client = new MongoClient(uri, {
  maxPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
  appName: "caleris-masters-query-plan-verification",
});

try {
  await client.connect();
  const db = client.db(databaseName);
  for (const [collectionName, label, filter, expectedIndex] of QUERY_PLAN_CASES) {
    const explanation = await db.collection(collectionName)
      .find(filter)
      .limit(5)
      .explain("queryPlanner");
    const winningPlan = explanation.queryPlanner?.winningPlan;
    const indexNames = collectIndexNames(winningPlan);
    if (!indexNames.includes(expectedIndex)) {
      throw new Error(
        `Expected ${collectionName} / ${label} to use ${expectedIndex}; got ${indexNames.join(", ") || "no index"}.`,
      );
    }
  }
  console.log(`Verified IXSCAN index selection for all ${QUERY_PLAN_CASES.length} primary query patterns in ${databaseName}.`);
} finally {
  await client.close();
}
