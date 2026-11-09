import { getDatabase } from "@/lib/mongodb";
import { getRuleset } from "@/lib/economy-rules";

export type LedgerInput = {
  accountName: string; direction: "Masuk" | "Keluar"; category: string;
  description?: string; amount?: number; points?: number; period: number; season: number; date?: string;
  referenceId?: string; metadata?: Record<string, unknown>;
};

const amountOf = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

async function resolveAccount(accountName: string) {
  const db = await getDatabase();
  const records = db.collection("admin_sheet_records");
  const member = await records.find({ sheet_key: "daftar-anggota" }).toArray();
  const match = member.find(x => String(x.row_data?.c1 ?? "").trim().toLowerCase() === accountName.trim().toLowerCase());
  if (match) {
    const role = String(match.row_data?.c3 ?? "");
    const team = String(match.row_data?.c2 ?? "");
    return { db, canonicalName: role === "Owner" && team ? team : accountName, type: role === "Owner" ? "team" as const : "individual" as const, role, team };
  }
  const teamRows = await records.find({ sheet_key: "data-tim" }).toArray();
  const teamMatch = teamRows.find(x => String(x.row_data?.c0 ?? "").trim().toLowerCase() === accountName.trim().toLowerCase());
  if (teamMatch) return { db, canonicalName: accountName, type: "team" as const, role: "Owner", team: accountName };
  throw new Error("Nama anggota atau tim tidak ditemukan di master data.");
}

export async function getAccountBalance(accountName: string, season?: number) {
  const ctx = await resolveAccount(accountName);
  const filter: Record<string, unknown> = { sheet_key: "transaksi", "row_data.c2": ctx.canonicalName };
  if (season) filter["row_data.c9"] = String(season);
  const rows = await ctx.db.collection("admin_sheet_records").find(filter).toArray();
  return rows.reduce((sum, item) => {
    const row = item.row_data ?? {};
    const n = amountOf(row.c6);
    return sum + (row.c3 === "Masuk" ? n : row.c3 === "Keluar" ? -n : 0);
  }, 0);
}

export async function postLedgerEntry(input: LedgerInput, adminId: string) {
  const accountName = input.accountName.trim();
  if (!accountName || !input.category.trim()) throw new Error("Nama akun dan kategori wajib diisi.");
  if (!Number.isInteger(input.period) || input.period < 1 || !Number.isInteger(input.season) || input.season < 1) throw new Error("Season dan periode harus bilangan bulat positif.");
  if (input.direction !== "Masuk" && input.direction !== "Keluar") throw new Error("Jenis transaksi tidak valid.");

  const ctx = await resolveAccount(accountName);
  const rules = await getRuleset(input.season);
  if (rules.status === "closed") throw new Error("Season sudah ditutup. Transaksi baru tidak dapat diposting.");
  if (!rules.enabledWorkflows.manualLedger) throw new Error("Pencatatan manual dinonaktifkan pada ruleset season ini.");

  const points = Math.max(0, Math.floor(amountOf(input.points)));
  let amount = input.amount === undefined ? amountOf(rules.tariffs[input.category]) : amountOf(input.amount);
  if (input.category.toLowerCase().includes("development mobil")) {
    if (!rules.enabledWorkflows.development) throw new Error("Development mobil dinonaktifkan pada season ini.");
    if (points < rules.development.minimumPoints) throw new Error(`Minimal development ${rules.development.minimumPoints} poin.`);
    amount = points * rules.development.carCostPerPoint;
  }
  if (input.category.toLowerCase().includes("development driver")) {
    if (!rules.enabledWorkflows.development) throw new Error("Development driver dinonaktifkan pada season ini.");
    if (points < rules.development.minimumPoints) throw new Error(`Minimal development ${rules.development.minimumPoints} poin.`);
    amount = points * rules.development.driverCostPerPoint;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Nominal harus lebih besar dari nol. Pastikan tarif kategori telah diatur.");

  const records = ctx.db.collection("admin_sheet_records");
  if (ctx.type === "team" && input.direction === "Keluar") {
    const rows = await records.find({ sheet_key: "transaksi", "row_data.c2": ctx.canonicalName, "row_data.c9": String(input.season) }).toArray();
    let income = 0, expenses = 0;
    for (const doc of rows) {
      const row = doc.row_data ?? {};
      const value = amountOf(row.c6);
      if (row.c3 === "Masuk") income += value;
      if (row.c3 === "Keluar") expenses += value;
    }
    if (income <= 0 || expenses + amount > Math.floor(income * rules.teamExpenseLimitRate)) {
      throw new Error(`Transaksi ditolak: batas pengeluaran tim ${(rules.teamExpenseLimitRate * 100).toLocaleString("id-ID")}% dari income season terlampaui.`);
    }
  }

  const now = new Date();
  const row_data = {
    c0: "", c1: input.date || now.toISOString().slice(0, 10), c2: ctx.canonicalName,
    c3: input.direction, c4: input.category.trim(), c5: input.description?.trim() ?? "",
    c6: String(amount), c7: String(input.period), c8: String(points), c9: String(input.season)
  };
  const result = await records.insertOne({
    sheet_key: "transaksi", row_data, sort_order: Date.now(),
    created_by: adminId, updated_by: adminId, created_at: now, updated_at: now,
    ledger_version: 2, account_type: ctx.type, reference_id: input.referenceId ?? null,
    metadata: input.metadata ?? {},
    rules_snapshot: {
      season: rules.season, ruleset_name: rules.name, teamExpenseLimitRate: rules.teamExpenseLimitRate,
      transferTax: rules.transferTax, wealthTax: rules.wealthTax, tariffs: { [input.category]: rules.tariffs[input.category] },
      development: rules.development
    }
  });
  await ctx.db.collection("audit_logs").insertOne({
    action: "ledger.transaction.created", actor_id: adminId, target_id: result.insertedId.toString(),
    metadata: { accountName: ctx.canonicalName, accountType: ctx.type, direction: input.direction, category: input.category, amount, season: input.season, period: input.period, ruleset: rules.name },
    created_at: now
  });
  return { id: result.insertedId.toString(), row_data, accountType: ctx.type, ruleset: rules.name };
}

export async function calculateTransferTax(grossAmount: number, season: number) {
  const rules = await getRuleset(season);
  return rules.transferTax.enabled && grossAmount > rules.transferTax.threshold ? Math.round(grossAmount * rules.transferTax.rate) : 0;
}

export async function calculateWealthTax(balance: number, accountType: "individual" | "team", season: number) {
  const rules = await getRuleset(season);
  const threshold = accountType === "team" ? rules.wealthTax.teamThreshold : rules.wealthTax.individualThreshold;
  return rules.wealthTax.enabled && balance > threshold ? Math.round(balance * rules.wealthTax.rate) : 0;
}

export async function calculateLateLoanInterest(principal: number, overduePeriods: number, season: number) {
  const rules = await getRuleset(season);
  return rules.loans.enabled ? Math.round(Math.max(0, principal) * rules.loans.lateInterestPerPeriod * Math.max(0, Math.floor(overduePeriods))) : 0;
}
