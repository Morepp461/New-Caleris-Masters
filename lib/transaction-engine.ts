import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export type LedgerInput = {
  accountName: string;
  direction: "Masuk" | "Keluar";
  category: string;
  description?: string;
  amount?: number;
  points?: number;
  period: number;
  season: number;
  date?: string;
};

export const FINAL_RULES = Object.freeze({
  currency: "¢p",
  teamExpenseRatio: 0.8,
  inactiveTeamFine: 2_000,
  inactiveDriverBalanceCut: 0.5,
  transferTaxThreshold: 50_000,
  transferTaxRate: 0.1,
  individualWealthTaxThreshold: 150_000,
  teamWealthTaxThreshold: 300_000,
  wealthTaxRate: 0.1,
  loanEligibilityBalance: 30_000,
  loanMaximum: 50_000,
  loanLateInterestPerPeriod: 0.05,
  sponsor: { participation: 50_000, zeroFines: 40_000, guaranteed: 30_000, zeroDebt: 10_000 },
  teamAidThreshold: 100_000,
  teamAidAmount: 10_000,
  prizeMoneyFirst: 50_000,
  prizeMoneySecond: 40_000,
  prizeMoneyStep: 2_000,
});

const money = (n: unknown) => {
  const value = typeof n === "number" ? n : Number(String(n ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? Math.round(value) : 0;
};

export function transferTax(gross: number) {
  return gross > FINAL_RULES.transferTaxThreshold ? Math.round(gross * FINAL_RULES.transferTaxRate) : 0;
}
export function wealthTax(balance: number, account: "individual" | "team") {
  const threshold = account === "team" ? FINAL_RULES.teamWealthTaxThreshold : FINAL_RULES.individualWealthTaxThreshold;
  return balance > threshold ? Math.round(balance * FINAL_RULES.wealthTaxRate) : 0;
}
export function lateLoanInterest(principal: number, overduePeriods: number) {
  return Math.round(Math.max(0, principal) * FINAL_RULES.loanLateInterestPerPeriod * Math.max(0, Math.floor(overduePeriods)));
}
export function developmentCost(kind: "mobil" | "driver", points: number) {
  const billablePoints = Math.max(10, Math.floor(points));
  return billablePoints * (kind === "mobil" ? 1_000 : 500);
}
export function sponsorPayout(flags: { participation: boolean; zeroFines: boolean; guaranteed: boolean; zeroDebt: boolean }) {
  return (flags.participation ? 50_000 : 0) + (flags.zeroFines ? 40_000 : 0) + (flags.guaranteed ? 30_000 : 0) + (flags.zeroDebt ? 10_000 : 0);
}
export function prizeMoney(position: number, totalTeams: number) {
  if (position < 1 || position > totalTeams) return 0;
  if (position === 1) return FINAL_RULES.prizeMoneyFirst;
  return Math.max(0, FINAL_RULES.prizeMoneySecond - (position - 2) * FINAL_RULES.prizeMoneyStep);
}

async function accountContext(accountName: string) {
  const db = await getDatabase();
  const members = await db.collection("admin_sheet_records").find({ sheet_key: "daftar-anggota", "row_data.c1": accountName }).limit(1).toArray();
  if (members[0]) {
    const row = members[0].row_data ?? {};
    const role = String(row.c3 ?? row.c10 ?? "");
    const team = String(row.c2 ?? row.c5 ?? "");
    return { db, accountName, accountType: role === "Owner" ? "team" as const : "individual" as const, team, role };
  }
  const teams = await db.collection("admin_sheet_records").find({ sheet_key: "data-tim", "row_data.c0": accountName }).limit(1).toArray();
  if (teams[0]) return { db, accountName, accountType: "team" as const, team: accountName, role: "Owner" };
  throw new Error("Nama anggota atau tim tidak ditemukan.");
}

export async function postLedgerEntry(input: LedgerInput, adminId: string) {
  const accountName = input.accountName.trim();
  if (!accountName || !input.category.trim()) throw new Error("Nama akun dan kategori wajib diisi.");
  if (!Number.isInteger(input.period) || input.period < 1 || !Number.isInteger(input.season) || input.season < 1) throw new Error("Season dan periode harus berupa bilangan bulat positif.");
  if (input.direction !== "Masuk" && input.direction !== "Keluar") throw new Error("Jenis transaksi tidak valid.");

  const ctx = await accountContext(accountName);
  let amount = money(input.amount);
  const points = Math.max(0, Math.floor(money(input.points)));
  if (input.category.includes("Development Mobil")) amount = developmentCost("mobil", points);
  if (input.category.includes("Development Driver")) amount = developmentCost("driver", points);

  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Nominal transaksi harus lebih besar dari nol.");

  const records = ctx.db.collection("admin_sheet_records");
  if (ctx.accountType === "team" && input.direction === "Keluar") {
    const seasonRows = await records.find({ sheet_key: "transaksi", "row_data.c2": accountName, "row_data.c9": String(input.season) }).toArray();
    let income = 0;
    let expense = 0;
    for (const item of seasonRows) {
      const row = item.row_data ?? {};
      const value = money(row.c6);
      if (row.c3 === "Masuk") income += value;
      if (row.c3 === "Keluar") expense += value;
    }
    if (income <= 0 || expense + amount > Math.floor(income * FINAL_RULES.teamExpenseRatio)) {
      throw new Error("Transaksi ditolak: pengeluaran tim tidak boleh melebihi 80% total income season.");
    }
  }

  const now = new Date();
  const row_data = {
    c0: "", c1: input.date || now.toISOString().slice(0, 10), c2: accountName,
    c3: input.direction, c4: input.category.trim(), c5: input.description?.trim() ?? "",
    c6: String(amount), c7: String(input.period), c8: String(points), c9: String(input.season),
  };
  const result = await records.insertOne({
    sheet_key: "transaksi", row_data, sort_order: Date.now(),
    created_by: adminId, updated_by: adminId, created_at: now, updated_at: now,
    ledger_version: 1, account_type: ctx.accountType,
  });
  await ctx.db.collection("audit_logs").insertOne({
    action: "ledger.transaction.created", actor_id: adminId, target_id: result.insertedId.toString(),
    metadata: { accountName, accountType: ctx.accountType, direction: input.direction, category: input.category, amount, season: input.season, period: input.period },
    created_at: now,
  });
  return { id: result.insertedId.toString(), row_data, accountType: ctx.accountType };
}

export async function getAccountBalance(accountName: string, season?: number) {
  const ctx = await accountContext(accountName);
  const filter: Record<string, unknown> = { sheet_key: "transaksi", "row_data.c2": accountName };
  if (season) filter["row_data.c9"] = String(season);
  const rows = await ctx.db.collection("admin_sheet_records").find(filter).toArray();
  return rows.reduce((total, item) => {
    const row = item.row_data ?? {};
    const amount = money(row.c6);
    return total + (row.c3 === "Masuk" ? amount : row.c3 === "Keluar" ? -amount : 0);
  }, 0);
}

export { ObjectId };
