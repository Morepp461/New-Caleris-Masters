import { getDatabase } from "@/lib/mongodb";

export type CalerisRuleset = {
  season: number;
  name: string;
  status: "draft" | "active" | "closed";
  currency: string;
  balancingEveryRaces: number;
  teamExpenseLimitRate: number;
  transferTax: { enabled: boolean; threshold: number; rate: number };
  wealthTax: { enabled: boolean; individualThreshold: number; teamThreshold: number; rate: number };
  inactive: { driverBalanceCutRate: number; driverLicenseDeduction: number; teamFine: number; principalExemptionEnabled: boolean };
  loans: { enabled: boolean; eligibilityBalanceBelow: number; maxPerRequest: number; lateInterestPerPeriod: number };
  development: { driverCostPerPoint: number; carCostPerPoint: number; minimumPoints: number; raceWinnerFreePoints: number };
  sponsorship: { participation: number; zeroFines: number; guaranteed: number; zeroDebt: number };
  teamAid: { enabled: boolean; balanceBelow: number; payout: number };
  prizeMoney: { enabled: boolean; first: number; second: number; decrementPerPosition: number; minimum: number };
  salary: { driverByLicense: Record<string, { min: number; max: number }>; principalMinimum: number; ownerContribution: number; agentPerSeason: number; journalistPerSeason: number; journalistViewBonus: number; journalistViewThreshold: number; fiaPerSeason: number };
  tariffs: Record<string, number>;
  roleUpgradeFees: Record<string, number>;
  teamRegistrationFees: Record<string, number>;
  enabledWorkflows: Record<string, boolean>;
};

export const DEFAULT_RULESET: Omit<CalerisRuleset, "season" | "name" | "status"> = {
  currency: "¢p",
  balancingEveryRaces: 5,
  teamExpenseLimitRate: 0.8,
  transferTax: { enabled: true, threshold: 50000, rate: 0.1 },
  wealthTax: { enabled: true, individualThreshold: 150000, teamThreshold: 300000, rate: 0.1 },
  inactive: { driverBalanceCutRate: 0.5, driverLicenseDeduction: 10, teamFine: 2000, principalExemptionEnabled: true },
  loans: { enabled: true, eligibilityBalanceBelow: 30000, maxPerRequest: 50000, lateInterestPerPeriod: 0.05 },
  development: { driverCostPerPoint: 500, carCostPerPoint: 1000, minimumPoints: 10, raceWinnerFreePoints: 3 },
  sponsorship: { participation: 50000, zeroFines: 40000, guaranteed: 30000, zeroDebt: 10000 },
  teamAid: { enabled: true, balanceBelow: 100000, payout: 10000 },
  prizeMoney: { enabled: true, first: 50000, second: 40000, decrementPerPosition: 2000, minimum: 0 },
  salary: {
    driverByLicense: {
      Amateur: { min: 2000, max: 3700 },
      Bronze: { min: 3750, max: 7500 },
      Silver: { min: 7525, max: 12500 },
      Gold: { min: 12525, max: 37500 },
      "Super License": { min: 37525, max: 62500 }
    },
    principalMinimum: 10000, ownerContribution: 200000, agentPerSeason: 20000,
    journalistPerSeason: 20000, journalistViewBonus: 5000, journalistViewThreshold: 5000, fiaPerSeason: 50000
  },
  tariffs: {
    "Poster After-Race (Driver)": 500,
    "Poster Sosmed (Driver)": 1000,
    "Daily Check-in": 500,
    "Uang Kontribusi Awal Season": 200000,
    "Sponsorship": 0,
    "Relief Fund": 10000,
    "Prize Money": 50000,
    "Registrasi Tim (Premio)": 25000,
    "Registrasi Tim (Zwei)": 15000,
    "Registrasi Tim (Caleris Trees)": 12000,
    "Maintenance Mobil": 1000,
    "Denda Steward": 500,
    "Denda Inactive Tim": 2000,
    "Driver Academy": 15000,
    "Biaya Development Mobil (per poin, min. 10)": 1000,
    "Biaya Development Driver (per poin, min. 10)": 500,
    "Wildcard": 5000,
    "Bonus Konten Jurnalis (per konten >=5000 view)": 5000
  },
  roleUpgradeFees: { Owner: 200000, FIA: 100000, Journalist: 50000, Agent: 50000, Driver: 0 },
  teamRegistrationFees: { Premio: 25000, Zwei: 15000, "Caleris Trees": 12000 },
  enabledWorkflows: {
    manualLedger: true, transfer: true, payroll: true, loans: true, wealthTax: true,
    inactivePenalties: true, sponsorship: true, prizeMoney: true, teamAid: true,
    development: true, teamRegistration: true, roleUpgrade: true, seasonClose: true
  }
};

export function validateRuleset(input: unknown): asserts input is CalerisRuleset {
  if (!input || typeof input !== "object") throw new Error("Ruleset tidak valid.");
  const r = input as CalerisRuleset;
  const numeric = [
    r.season, r.balancingEveryRaces, r.teamExpenseLimitRate,
    r.transferTax?.threshold, r.transferTax?.rate, r.wealthTax?.individualThreshold,
    r.wealthTax?.teamThreshold, r.wealthTax?.rate, r.inactive?.driverBalanceCutRate,
    r.inactive?.driverLicenseDeduction, r.inactive?.teamFine, r.loans?.eligibilityBalanceBelow,
    r.loans?.maxPerRequest, r.loans?.lateInterestPerPeriod, r.development?.driverCostPerPoint,
    r.development?.carCostPerPoint, r.development?.minimumPoints, r.development?.raceWinnerFreePoints,
    r.sponsorship?.participation, r.sponsorship?.zeroFines, r.sponsorship?.guaranteed,
    r.sponsorship?.zeroDebt, r.teamAid?.balanceBelow, r.teamAid?.payout,
    r.prizeMoney?.first, r.prizeMoney?.second, r.prizeMoney?.decrementPerPosition,
    r.prizeMoney?.minimum, r.salary?.principalMinimum, r.salary?.ownerContribution,
    r.salary?.agentPerSeason, r.salary?.journalistPerSeason, r.salary?.journalistViewBonus,
    r.salary?.journalistViewThreshold, r.salary?.fiaPerSeason
  ];
  if (!Number.isInteger(r.season) || r.season < 1 || !Number.isInteger(r.balancingEveryRaces) || r.balancingEveryRaces < 1) throw new Error("Season dan interval balancing harus bilangan bulat positif.");
  if (numeric.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0)) throw new Error("Semua nominal dan parameter numerik harus bernilai valid dan tidak negatif.");
  if (r.teamExpenseLimitRate > 1 || r.transferTax.rate > 1 || r.wealthTax.rate > 1 || r.inactive.driverBalanceCutRate > 1 || r.loans.lateInterestPerPeriod > 1) throw new Error("Parameter persentase harus berada pada rentang 0 sampai 1.");
  if (!r.name?.trim() || !r.currency?.trim() || !r.tariffs || !r.teamRegistrationFees || !r.roleUpgradeFees || !r.enabledWorkflows) throw new Error("Nama ruleset, mata uang, tarif, biaya registrasi, upgrade role, dan workflow wajib tersedia.");
  for (const group of [r.tariffs, r.teamRegistrationFees, r.roleUpgradeFees]) {
    if (Object.values(group).some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new Error("Tarif dan biaya harus berupa angka valid dan tidak negatif.");
  }
  for (const band of Object.values(r.salary.driverByLicense)) {
    if (!Number.isFinite(band.min) || !Number.isFinite(band.max) || band.min < 0 || band.max < band.min) throw new Error("Rentang gaji lisensi tidak valid.");
  }
}

export async function getRuleset(season: number) {
  const db = await getDatabase();
  const existing = await db.collection<CalerisRuleset>("economy_rulesets").findOne({ season });
  if (existing) return existing;
  const ruleset = { ...structuredClone(DEFAULT_RULESET), season, name: `Season ${season}`, status: "draft" as const };
  await db.collection<CalerisRuleset>("economy_rulesets").updateOne({ season }, { $setOnInsert: ruleset }, { upsert: true });
  return (await db.collection<CalerisRuleset>("economy_rulesets").findOne({ season })) ?? ruleset;
}

export async function saveRuleset(input: unknown, actorId: string) {
  validateRuleset(input);
  const db = await getDatabase();
  const current = await db.collection<CalerisRuleset>("economy_rulesets").findOne({ season: input.season });
  if (current?.status === "closed") throw new Error("Ruleset season yang sudah ditutup tidak dapat diubah.");
  const now = new Date();
  await db.collection("economy_rulesets").updateOne(
    { season: input.season },
    { $set: { ...input, updated_at: now, updated_by: actorId }, $setOnInsert: { created_at: now, created_by: actorId } },
    { upsert: true }
  );
  await db.collection("audit_logs").insertOne({ action: "economy.ruleset.updated", actor_id: actorId, target_id: String(input.season), metadata: { season: input.season, name: input.name }, created_at: now });
  return getRuleset(input.season);
}
