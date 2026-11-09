import { MongoClient } from "mongodb";
import { COLLECTION_VALIDATORS } from "./collections.mjs";

const database = process.env.MONGODB_DB, uri = process.env.MONGODB_URI;
if (!process.argv.includes("--confirm-empty-phase-08")) throw new Error("Explicit --confirm-empty-phase-08 confirmation is required.");
if (!uri || !database || (!database.endsWith("_dev") && !database.endsWith("_staging"))) throw new Error("Rollback is restricted to _dev or _staging databases.");
const collections = ["economy_accounts","ledger_transactions","ledger_entries","economy_rulesets","economy_periods","loans","development_wallets","development_transactions"];
const indexes = {
  ledger_transactions: ["ix_ledger_transactions_created_status","ix_ledger_transactions_category_date","uq_ledger_transaction_single_reversal"],
  ledger_entries: ["uq_ledger_entry_transaction_account_direction"],
  development_transactions: ["uq_development_transactions_idempotency","ix_development_transactions_owner_token_date"],
  economy_rulesets: ["uq_economy_rulesets_season_version","ix_economy_rulesets_season_status_version","uq_economy_rulesets_one_active_per_season"],
  economy_periods: ["uq_economy_periods_season_period","ix_economy_periods_status_start"],
  loans: ["ix_loans_team_status_date","uq_loans_one_active_per_team"],
};
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000, appName: "caleris-masters-phase-08-rollback" });
try {
  await client.connect();
  const db = client.db(database);
  for (const name of collections) {
    const count = await db.collection(name).countDocuments({});
    if (count !== 0) throw new Error("Rollback blocked: " + name + " contains " + count + " documents. Use a forward-fix/reconciliation plan instead.");
  }
  for (const [collection, names] of Object.entries(indexes)) {
    const existing = new Set((await db.collection(collection).listIndexes().toArray()).map((item) => item.name));
    for (const name of names) if (existing.has(name)) await db.collection(collection).dropIndex(name);
  }
  await db.command({ collMod: "development_transactions", validator: COLLECTION_VALIDATORS.development_transactions, validationLevel: "strict", validationAction: "error" });
  await db.collection("schema_migrations").deleteOne({ _id: "007-economy-currency-development-wallets" });
  console.log("Rolled back Phase 08 schema/index additions. No economy data was present or deleted.");
} finally { await client.close(); }
