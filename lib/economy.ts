export type MemberRole = "driver" | "principal" | "agent" | "journalist" | "fia";
export type MemberStatus = "active" | "inactive";
export type TransactionType = "income" | "expense";

export const DEFAULT_STATE = Object.freeze({members:0,teams:0,circulatingBalance:0,racesCompleted:0,balancingPeriod:0,season:0});

export const STANDARD_TARIFFS = {
  afterRacePoster:1_000,socialPoster:5_000,dailyCheckIn:500,initialSeasonContribution:100_000,
  reliefFund:10_000,teamRegistration:25_000,carMaintenance:1_000,stewardFine:500,
  inactiveFine:1_000,driverAcademy:1_500,development:1_000_000,wildcard:5_000
} as const;

export function driverSalaryPerRace(role:MemberRole,status:MemberStatus,division:"premio"|"zwei"):number {
  if(role!=="driver"||status!=="active") return 0;
  return division==="premio"?1_000:500;
}
export function accumulatedSalary(role:MemberRole,status:MemberStatus,division:"premio"|"zwei",races:number):number {
  return driverSalaryPerRace(role,status,division)*Math.max(0,Math.floor(races));
}
export function individualBalance(openingBalance:number,salary:number,otherIncome:number,expenses:number):number {
  return openingBalance+salary+otherIncome-expenses;
}
export function wealthTaxRate(balance:number):0|0.05|0.1 {
  // Exactly ¢p150,000 remains in tier 0; see README for source-boundary caveat.
  if(balance<=150_000)return 0;
  if(balance<=300_000)return 0.05;
  return 0.1;
}
export function estimateWealthTax(principalBalance:number):number {
  return Math.round(Math.max(0,principalBalance)*wealthTaxRate(principalBalance));
}
export function lateLoanInterest(principal:number,dueDate:Date,paidDate:Date):number {
  const lateDays=Math.max(0,Math.ceil((paidDate.getTime()-dueDate.getTime())/86_400_000));
  return Math.round(Math.max(0,principal)*0.05*lateDays);
}
export function driverTransferTax(grossAmount:number):number {
  return grossAmount>50_000?Math.round(grossAmount*0.1):0;
}
export function teamBalanceFromPrincipal(principalBalance:number):number{return principalBalance;}
export function bankBalance(input:{openingCapital:number;loansDisbursed:number;repaymentsAndInterest:number;wealthTaxes:number;fines:number;transferTaxes:number}):number {
  return input.openingCapital-input.loansDisbursed+input.repaymentsAndInterest+input.wealthTaxes+input.fines+input.transferTaxes;
}
export function sponsorshipReward(input:{allDriversCheckedInFiveTimes:boolean;zeroFines:boolean;guaranteedSponsorFunds:boolean;zeroSeasonDebt:boolean}):number {
  return (input.allDriversCheckedInFiveTimes?50_000:0)+(input.zeroFines?40_000:0)+(input.guaranteedSponsorFunds?30_000:0)+(input.zeroSeasonDebt?10_000:0);
}
export function balancingPeriodForRace(raceNumber:number):number{return raceNumber<=0?0:Math.ceil(raceNumber/5);}
export function racesUntilNextBalancing(raceNumber:number):number {
  if(raceNumber<=0)return 5;
  return 5-((raceNumber-1)%5)-1;
}
export function formatCurrency(value:number):string{return `¢p${Math.round(value).toLocaleString("id-ID")}`;}
