import { ObjectId } from "mongodb";
import { getMongoClient, getDatabase } from "@/lib/mongodb";
import { getRuleset } from "@/lib/economy-rules";

type Direction = "Masuk" | "Keluar";
type Account = { name: string; type: "individual" | "team" | "bank" };
type WorkflowInput = { action: string; season: number; period: number; date?: string; [key: string]: unknown };
const money = (v: unknown) => { const n = typeof v === "number" ? v : Number(v); if (!Number.isFinite(n)) throw new Error("Nominal tidak valid."); return Math.round(n); };

async function accountExists(db: Awaited<ReturnType<typeof getDatabase>>, account: Account) {
  if (account.type === "bank") return;
  const key = account.type === "team" ? "data-tim" : "daftar-anggota";
  const column = account.type === "team" ? "c0" : "c1";
  const rows = await db.collection("admin_sheet_records").find({ sheet_key: key }).toArray();
  if (!rows.some(x => String(x.row_data?.[column] ?? "").trim().toLowerCase() === account.name.trim().toLowerCase())) throw new Error(`Akun ${account.name} tidak ditemukan.`);
}

async function balance(db: Awaited<ReturnType<typeof getDatabase>>, account: Account, season?: number, session?: any) {
  if (account.type === "bank") {
    const bank = await db.collection("economy_accounts").findOne({ account_key: "vreeo-bank" }, { session });
    if (bank) return Number(bank.balance ?? 0);
    const opening = season ? Number((await getRuleset(season)).bankOpeningBalance) : 999999999;
    await db.collection("economy_accounts").updateOne({account_key:"vreeo-bank"},{$setOnInsert:{balance:opening,created_at:new Date(),source:season?"economy_rulesets.bankOpeningBalance":"backup-settings.vreeoBankSaldoAwal"}},{upsert:true,session});
    return opening;
  }
  const filter: Record<string, unknown> = { sheet_key: "transaksi", "row_data.c2": account.name };
  if (season) filter["row_data.c9"] = String(season);
  const rows = await db.collection("admin_sheet_records").find(filter, { session }).toArray();
  const opening = season ? await db.collection("opening_balances").findOne({season,account_name:account.name,account_type:account.type},{session}) : null;
  return Number(opening?.balance ?? 0) + rows.reduce((s,x)=>s+(x.row_data?.c3==="Masuk"?money(x.row_data?.c6):x.row_data?.c3==="Keluar"?-money(x.row_data?.c6):0),0);
}

async function writeEntry(db: Awaited<ReturnType<typeof getDatabase>>, session: any, adminId: string, account: Account, direction: Direction, category: string, amount: number, input: WorkflowInput, description = "", refId: string) {
  if (amount <= 0) return null;
  const now = new Date();
  const doc = {
    sheet_key: "transaksi",
    row_data: { c0:"", c1:String(input.date ?? now.toISOString().slice(0,10)), c2:account.name, c3:direction, c4:category, c5:description, c6:String(amount), c7:String(input.period), c8:"0", c9:String(input.season) },
    sort_order: now.getTime(), created_by:adminId, updated_by:adminId, created_at:now, updated_at:now,
    ledger_version:3, account_type:account.type, reference_id:refId, workflow_generated:true
  };
  const result=await db.collection("admin_sheet_records").insertOne(doc,{session});
  await db.collection("audit_logs").insertOne({action:"ledger.workflow.entry",actor_id:adminId,target_id:result.insertedId.toString(),metadata:{account:account.name,direction,category,amount,season:input.season,period:input.period,referenceId:refId},created_at:now},{session});
  return result.insertedId;
}

export async function executeEconomyWorkflow(input: WorkflowInput, adminId: string) {
  if (!Number.isInteger(input.season)||input.season<1||!Number.isInteger(input.period)||input.period<1) throw new Error("Season dan periode wajib berupa bilangan bulat positif.");
  const db=await getDatabase(), client=await getMongoClient(), rules=await getRuleset(input.season);
  if (rules.status==="closed") throw new Error("Season sudah ditutup.");
  const action=String(input.action);
  const session=client.startSession();
  const refId=new ObjectId().toString();
  let result: Record<string,unknown>={referenceId:refId,action};
  try {
    await session.withTransaction(async()=>{
      const entries: Array<{account:Account;direction:Direction;category:string;amount:number;description?:string}>=[];
      const team=(name:string):Account=>({name,type:"team"});
      const driver=(name:string):Account=>({name,type:"individual"});
      const bank:Account={name:"Vreeo Bank",type:"bank"};
      const add=async(a:Account,d:Direction,c:string,n:number,desc="")=>{await accountExists(db,a);entries.push({account:a,direction:d,category:c,amount:money(n),description:desc});};

      if(action==="reverse_workflow"){
        const target=String(input.referenceId??"");
        if(!target)throw new Error("Reference ID workflow wajib diisi.");
        const originals=await db.collection("admin_sheet_records").find({sheet_key:"transaksi",reference_id:target,voided:{$ne:true},reversed_by:{$exists:false}},{session}).toArray();
        if(!originals.length)throw new Error("Workflow aktif tidak ditemukan atau sudah dibatalkan.");
        for(const original of originals){
          const row=original.row_data??{},type=original.account_type==="bank"?"bank":original.account_type==="team"?"team":"individual";
          const account:Account={name:String(row.c2??""),type};
          entries.push({account,direction:row.c3==="Masuk"?"Keluar":"Masuk",category:`Reversal: ${String(row.c4??"Transaksi")}`,amount:money(row.c6),description:`Pembatalan transaksi ${target}`});
          await db.collection("admin_sheet_records").updateOne({_id:original._id},{$set:{reversed_by:refId,reversed_at:new Date(),reversed_by_admin:adminId}},{session});
        }
        const loan=await db.collection("bank_loans").findOne({reference_id:target},{session});
        if(loan)await db.collection("bank_loans").updateOne({_id:loan._id},{$set:{status:"reversed",reversed_at:new Date(),reversed_by:adminId}},{session});
        const transfer=await db.collection("driver_transfers").findOne({reference_id:target},{session});
        if(transfer){
          await db.collection("driver_transfers").updateOne({_id:transfer._id},{$set:{status:"reversed",reversed_at:new Date(),reversed_by:adminId}},{session});
          const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
          const member=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===String(transfer.driver).toLowerCase());
          if(member)await db.collection("admin_sheet_records").updateOne({_id:member._id},{$set:{"row_data.c2":transfer.from_team,updated_at:new Date(),updated_by:adminId}},{session});
        }
        await db.collection("sponsorship_payouts").updateOne({reference_id:target},{$set:{status:"reversed",reversed_at:new Date(),reversed_by:adminId}},{session});
        result={...result,reversedReference:target,entries:originals.length};
      } else if(action==="transfer"){
        if(!rules.enabledWorkflows.transfer)throw new Error("Workflow transfer dinonaktifkan.");
        const driverName=String(input.driverName??""),from=team(String(input.fromTeam??"")),to=team(String(input.toTeam??"")),gross=money(input.grossAmount);
        if(!driverName||from.name===to.name||gross<=0)throw new Error("Data transfer tidak valid.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"}).toArray();
        const member=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===driverName.toLowerCase());
        if(!member)throw new Error("Driver tidak ditemukan.");
        if(String(member.row_data?.c2??"")!==from.name)throw new Error("Tim asal tidak sesuai dengan master anggota.");
        const tax=rules.transferTax.enabled&&gross>rules.transferTax.threshold?Math.round(gross*rules.transferTax.rate):0;
        const buyerBalance=await balance(db,to,input.season,session);
        if(buyerBalance<gross)throw new Error("Saldo tim pembeli tidak cukup.");
        await add(to,"Keluar","Transfer Driver",gross,`Pembelian ${driverName} dari ${from.name}`);
        await add(from,"Masuk","Income Transfer (Jual Driver)",gross-tax,`Penjualan ${driverName} ke ${to.name}`);
        if(tax)await add(bank,"Masuk","Pajak Transfer Driver",tax,`Pajak transfer ${driverName}`);
        await db.collection("admin_sheet_records").updateOne({_id:member._id},{$set:{"row_data.c2":to.name,updated_at:new Date(),updated_by:adminId}},{session});
        await db.collection("driver_transfers").insertOne({reference_id:refId,driver:driverName,from_team:from.name,to_team:to.name,gross_amount:gross,tax,net_amount:gross-tax,season:input.season,period:input.period,created_at:new Date(),created_by:adminId},{session});
        await db.collection("admin_sheet_records").insertOne({sheet_key:"riwayat-transfer-driver",row_data:{c0:"",c1:String(input.date??new Date().toISOString().slice(0,10)),c2:driverName,c3:from.name,c4:to.name,c5:String(gross),c6:tax>0?"Ya":"Tidak",c7:String(tax),c8:String(gross-tax),c9:"Transfer disahkan",c10:String(input.period),c11:String(input.season)},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});
        result={...result,driver:driverName,gross,tax,net:gross-tax};
      } else if(action==="loan_issue"){
        if(!rules.loans.enabled||!rules.enabledWorkflows.loans)throw new Error("Pinjaman dinonaktifkan.");
        const t=team(String(input.teamName??"")),principal=money(input.amount),due=money(input.duePeriod);
        const active=await db.collection("bank_loans").find({team:t.name,status:{$in:["active","overdue"]}},{session}).toArray();
        if(active.length)throw new Error("Tim masih memiliki pinjaman yang belum lunas.");
        const current=await balance(db,t,input.season,session);
        if(current>=rules.loans.eligibilityBalanceBelow)throw new Error(`Saldo tim harus di bawah ¢p${rules.loans.eligibilityBalanceBelow.toLocaleString("id-ID")}.`);
        if(principal<=0||principal>rules.loans.maxPerRequest||due<=input.period)throw new Error("Nominal pinjaman atau jatuh tempo tidak valid.");
        await add(bank,"Keluar","Pencairan Pinjaman Bank",principal,`Pinjaman ${t.name}`);
        await add(t,"Masuk","Pencairan Pinjaman Bank",principal,"Pencairan Vreeo Bank");
        await db.collection("bank_loans").insertOne({reference_id:refId,team:t.name,principal,remaining:principal,season:input.season,issued_period:input.period,due_period:due,periods_per_season:rules.periodsPerSeason,paid_period:null,status:"active",created_at:new Date(),created_by:adminId},{session});
        result={...result,team:t.name,principal,duePeriod:due};
      } else if(action==="loan_repay"){
        const loanId=String(input.loanId??"");if(!ObjectId.isValid(loanId))throw new Error("ID pinjaman tidak valid.");
        const loan=await db.collection("bank_loans").findOne({_id:new ObjectId(loanId)},{session});if(!loan||!["active","overdue"].includes(loan.status))throw new Error("Pinjaman aktif tidak ditemukan.");
        const repayment=money(input.amount),currentGlobal=(input.season-1)*rules.periodsPerSeason+input.period,dueGlobal=(Number(loan.season)-1)*Number(loan.periods_per_season??rules.periodsPerSeason)+Number(loan.due_period),periods=Math.max(0,currentGlobal-dueGlobal);
        const interest=periods>0?Math.round(Number(loan.remaining)*rules.loans.lateInterestPerPeriod*periods):0;
        const due=Number(loan.remaining)+interest;
        if(repayment<=0||repayment>due)throw new Error("Nominal pembayaran melebihi tagihan atau tidak valid.");
        const t=team(String(loan.team)),available=await balance(db,t,input.season,session);if(available<repayment)throw new Error("Saldo tim tidak cukup untuk membayar pinjaman.");
        await add(t,"Keluar","Cicilan Pinjaman Bank",repayment,`Pelunasan pinjaman ${loan.reference_id}`);
        await add(bank,"Masuk","Cicilan Pinjaman Bank",repayment,"Pembayaran pinjaman");
        const remain=due-repayment;
        await db.collection("bank_loans").updateOne({_id:loan._id},{$set:{remaining:remain,status:remain===0?"paid":"overdue",paid_period:remain===0?input.period:null,last_interest:interest,updated_at:new Date()}},{session});
        result={...result,team:t.name,repayment,interest,remaining:remain};
      } else if(action==="owner_contribution"){
        const ownerName=String(input.ownerName??"");
        const prior=await db.collection("economy_workflows").findOne({action:"owner_contribution",season:input.season,"input.ownerName":ownerName,status:"posted"},{session});
        if(prior)throw new Error("Kontribusi Owner untuk season ini sudah dicatat.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"}).toArray();
        const owner=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===ownerName.toLowerCase()&&String(x.row_data?.c3??"")==="Owner");
        if(!owner)throw new Error("Owner tidak ditemukan.");
        const teamName=String(owner.row_data?.c2??"");
        const amount=money(input.amount??rules.salary.ownerContribution);
        await add(bank,"Keluar","Uang Kontribusi Awal Season",amount,`Kontribusi Owner ${ownerName} ke ${teamName}`);
        await add(team(teamName),"Masuk","Uang Kontribusi Awal Season",amount,`Kontribusi Owner ${ownerName}`);
        result={...result,owner:ownerName,team:teamName,amount};
      } else if(action==="payroll"){
        if(!rules.enabledWorkflows.payroll)throw new Error("Payroll dinonaktifkan.");
        const memberName=String(input.memberName??"");
        const prior=await db.collection("economy_workflows").findOne({action:"payroll",season:input.season,period:input.period,"input.memberName":memberName,status:"posted"},{session});
        if(prior)throw new Error("Payroll anggota ini sudah dibayarkan pada periode tersebut.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"}).toArray();
        const member=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===memberName.toLowerCase());
        if(!member)throw new Error("Anggota tidak ditemukan.");
        const role=String(member.row_data?.c3??"Driver"),teamName=String(member.row_data?.c2??"");
        if(role!=="Driver"&&role!=="FIA")throw new Error("Payroll otomatis hanya tersedia untuk Driver dan FIA. Owner menerima kontribusi off-season, bukan gaji.");
        const license=String(member.row_data?.c11??"");
        const seasonalSalary=role==="FIA"?rules.salary.fiaPerSeason:money(member.row_data?.c7);
        const salary=money(input.amount??Math.round(seasonalSalary/rules.periodsPerSeason));
        if(salary<=0)throw new Error("Gaji harus lebih besar dari nol.");
        if(role==="Driver"){const band=rules.salary.driverByLicense[license.replace(" License","")]??rules.salary.driverByLicense[license];if(band&&(seasonalSalary<band.min||seasonalSalary>band.max))throw new Error(`Gaji kontrak driver di luar rentang lisensi ${license}: ¢p${band.min}–${band.max} per season.`);}
        const payer=role==="Driver"?team(teamName):bank;
        const payee=driver(memberName);
        if(payer.type==="team"&&await balance(db,payer,input.season,session)<salary)throw new Error("Saldo tim tidak cukup untuk payroll.");
        await add(payer,"Keluar",`Gaji ${role}`,salary,`Gaji ${memberName}, Season ${input.season} Periode ${input.period}`);
        await add(payee,"Masuk",`Gaji ${role}`,salary,`Pembayaran gaji dari ${payer.name}`);
        result={...result,member:memberName,salary,seasonalSalary,payer:payer.name};
      } else if(action==="wealth_tax"){
        if(!rules.enabledWorkflows.wealthTax||!rules.wealthTax.enabled)throw new Error("Pajak kekayaan dinonaktifkan.");
        const name=String(input.accountName??""),type=input.accountType==="team"?"team":"individual",a=type==="team"?team(name):driver(name);
        const current=await balance(db,a,input.season,session),threshold=type==="team"?rules.wealthTax.teamThreshold:rules.wealthTax.individualThreshold;
        const tax=current>threshold?Math.round(current*rules.wealthTax.rate):0;
        if(tax<=0)throw new Error("Saldo akun belum melewati ambang pajak.");
        await add(a,"Keluar","Pajak Kekayaan",tax,`Pajak ${rules.wealthTax.rate*100}% atas saldo ¢p${current}`);
        await add(bank,"Masuk","Pajak Kekayaan",tax,`Penerimaan pajak dari ${name}`);
        result={...result,account:name,balance:current,tax};
      } else if(action==="inactive_penalty"){
        if(!rules.enabledWorkflows.inactivePenalties)throw new Error("Sanksi inactive dinonaktifkan.");
        const kind=String(input.accountType),name=String(input.accountName),a=kind==="team"?team(name):driver(name);
        const current=await balance(db,a,input.season,session);
        const penalty=kind==="team"?rules.inactive.teamFine:Math.round(Math.max(0,current)*rules.inactive.driverBalanceCutRate);
        if(penalty<=0)throw new Error("Tidak ada nominal sanksi yang dapat ditagihkan.");
        await add(a,"Keluar",kind==="team"?"Denda Inactive Tim":"Denda Inactive Driver",penalty,"Sanksi status inactive");
        await add(bank,"Masuk",kind==="team"?"Denda Inactive Tim":"Denda Inactive Driver",penalty,"Penerimaan sanksi inactive");
        result={...result,account:name,penalty};
      } else if(action==="sponsorship"){
        if(!rules.enabledWorkflows.sponsorship)throw new Error("Sponsorship dinonaktifkan.");
        const t=team(String(input.teamName??"")),flags=input.flags as Record<string,boolean>;
        if(!flags||typeof flags!=="object")throw new Error("Komponen sponsorship belum dipilih.");
        const fines=await db.collection("admin_sheet_records").find({sheet_key:"transaksi","row_data.c2":t.name,"row_data.c9":String(input.season),"row_data.c4":{$regex:"Denda",$options:"i"},voided:{$ne:true}},{session}).toArray();
        const debts=await db.collection("bank_loans").find({team:t.name,status:{$in:["active","overdue"]}},{session}).toArray();
        if(flags.t2&&fines.length)throw new Error("T2 tidak memenuhi syarat: tim memiliki catatan denda pada season ini.");
        if(flags.t4&&debts.length)throw new Error("T4 tidak memenuhi syarat: tim masih memiliki hutang bank season ini.");
        const amount=(flags.t1?rules.sponsorship.participation:0)+(flags.t2?rules.sponsorship.zeroFines:0)+(flags.t3?rules.sponsorship.guaranteed:0)+(flags.t4?rules.sponsorship.zeroDebt:0);
        if(amount<=0)throw new Error("Tidak ada komponen sponsorship yang memenuhi syarat.");
        await add(bank,"Keluar","Sponsorship",amount,`T1:${!!flags.t1} T2:${!!flags.t2} T3:${!!flags.t3} T4:${!!flags.t4}`);
        await add(t,"Masuk","Sponsorship",amount,"Pencairan sponsorship season");
        await db.collection("sponsorship_payouts").insertOne({reference_id:refId,team:t.name,flags,amount,season:input.season,period:input.period,created_at:new Date()},{session});
        result={...result,team:t.name,amount,flags};
      } else if(action==="prize_money"){
        if(!rules.enabledWorkflows.prizeMoney||!rules.prizeMoney.enabled)throw new Error("Prize money dinonaktifkan.");
        const rank=money(input.position);if(rank<1)throw new Error("Posisi klasemen tidak valid.");
        const amount=Math.max(rules.prizeMoney.minimum,rank===1?rules.prizeMoney.first:rank===2?rules.prizeMoney.second:rules.prizeMoney.second-(rank-2)*rules.prizeMoney.decrementPerPosition);
        if(input.recipientType==="driver")throw new Error("Prize Money ini adalah WCC dan hanya dibayarkan kepada tim.");
        const recipient=team(String(input.recipientName??""));
        if(amount<=0)throw new Error("Prize money posisi ini bernilai nol.");
        await add(bank,"Keluar","Prize Money",amount,`P${rank} Season ${input.season}`);
        await add(recipient,"Masuk","Prize Money",amount,`Prize Money P${rank}`);
        result={...result,recipient:recipient.name,position:rank,amount};
      } else if(action==="team_aid"){
        if(!rules.enabledWorkflows.teamAid||!rules.teamAid.enabled)throw new Error("Bantuan tim dinonaktifkan.");
        const t=team(String(input.teamName??"")),current=await balance(db,t,input.season,session);
        if(current>=rules.teamAid.balanceBelow)throw new Error("Saldo tim tidak memenuhi syarat bantuan.");
        await add(bank,"Keluar","Relief Fund",rules.teamAid.payout,"Bantuan akhir season");
        await add(t,"Masuk","Relief Fund",rules.teamAid.payout,"Bantuan akhir season");
        result={...result,team:t.name,balance:current,amount:rules.teamAid.payout};
      } else if(action==="development"){
        if(!rules.enabledWorkflows.development)throw new Error("Development dinonaktifkan.");
        const kind=String(input.accountType),name=String(input.accountName),points=money(input.points),winner=input.raceWinner===true;
        if(points<rules.development.minimumPoints)throw new Error(`Minimal pembelian ${rules.development.minimumPoints} poin.`);
        const account=kind==="team"?team(name):driver(name);
        const free=winner?rules.development.raceWinnerFreePoints:0;
        const rate=kind==="team"?rules.development.carCostPerPoint:rules.development.driverCostPerPoint;
        const amount=points*rate;
        await add(account,"Keluar",kind==="team"?"Biaya Development Mobil (per poin, min. 10)":"Biaya Development Driver (per poin, min. 10)",amount,`Pembelian ${points} poin + ${free} poin gratis pemenang race`);
        result={...result,account:name,accountType:kind,paidPoints:points,freePoints:free,totalPoints:points+free,amount};
      } else if(action==="period_settlement"){
        if(!rules.enabledWorkflows.wealthTax&&!rules.enabledWorkflows.inactivePenalties)throw new Error("Semua penilaian periode dinonaktifkan.");
        const prior=await db.collection("economy_workflows").findOne({action:"period_settlement",season:input.season,period:input.period,status:"posted"},{session});
        if(prior)throw new Error("Periode ini sudah pernah diselesaikan. Hindari pemotongan ganda.");
        const memberRows=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const teamRows=await db.collection("admin_sheet_records").find({sheet_key:"data-tim"},{session}).toArray();
        const assessed:Array<{name:string;tax:number;penalty:number;kind:string}>=[];
        for(const m of memberRows){
          const name=String(m.row_data?.c1??""),role=String(m.row_data?.c3??""),status=String(m.row_data?.c4??"");
          if(!name||role!=="Driver")continue;
          const a=driver(name),current=await balance(db,a,input.season,session);
          const tax=rules.enabledWorkflows.wealthTax&&rules.wealthTax.enabled&&current>rules.wealthTax.individualThreshold?Math.round(current*rules.wealthTax.rate):0;
          const penalty=rules.enabledWorkflows.inactivePenalties&&status.toLowerCase().includes("inactive")?Math.round(Math.max(0,current)*rules.inactive.driverBalanceCutRate):0;
          if(tax){await add(a,"Keluar","Pajak Kekayaan",tax,`Pajak periode ${input.period}`);await add(bank,"Masuk","Pajak Kekayaan",tax,`Pajak individu ${name}`);}
          if(penalty){await add(a,"Keluar","Denda Inactive Driver",penalty,"Sanksi inactive driver");await add(bank,"Masuk","Denda Inactive Driver",penalty,`Denda inactive ${name}`);}
          assessed.push({name,tax,penalty,kind:"individual"});
        }
        for(const t of teamRows){
          const name=String(t.row_data?.c0??""),status=String(t.row_data?.c5??"");
          if(!name)continue;
          const a=team(name),current=await balance(db,a,input.season,session);
          const tax=rules.enabledWorkflows.wealthTax&&rules.wealthTax.enabled&&current>rules.wealthTax.teamThreshold?Math.round(current*rules.wealthTax.rate):0;
          const penalty=rules.enabledWorkflows.inactivePenalties&&status.toLowerCase().includes("inactive")?rules.inactive.teamFine:0;
          if(tax){await add(a,"Keluar","Pajak Kekayaan",tax,`Pajak periode ${input.period}`);await add(bank,"Masuk","Pajak Kekayaan",tax,`Pajak tim ${name}`);}
          if(penalty){await add(a,"Keluar","Denda Inactive Tim",penalty,"Sanksi inactive tim");await add(bank,"Masuk","Denda Inactive Tim",penalty,`Denda inactive ${name}`);}
          assessed.push({name,tax,penalty,kind:"team"});
        }
        result={...result,assessedCount:assessed.length,totalTax:assessed.reduce((s,x)=>s+x.tax,0),totalPenalty:assessed.reduce((s,x)=>s+x.penalty,0)};
      } else if(action==="season_close"){
        if(!rules.enabledWorkflows.seasonClose)throw new Error("Season closing dinonaktifkan.");
        const existing=await db.collection("season_economy_snapshots").findOne({season:input.season},{session});
        if(existing)throw new Error("Snapshot season sudah ada. Penutupan tidak dapat diulang.");
        const memberRows=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const teamRows=await db.collection("admin_sheet_records").find({sheet_key:"data-tim"},{session}).toArray();
        const balances:Array<{name:string;type:string;balance:number}>=[];
        for(const m of memberRows){const name=String(m.row_data?.c1??""),role=String(m.row_data?.c3??"");if(name&&role==="Driver")balances.push({name,type:"individual",balance:await balance(db,driver(name),input.season,session)});}
        for(const t of teamRows){const name=String(t.row_data?.c0??"");if(name)balances.push({name,type:"team",balance:await balance(db,team(name),input.season,session)});}
        const debts=await db.collection("bank_loans").find({season:input.season,status:{$in:["active","overdue"]}},{session}).toArray();
        const bankBalance=await balance(db,bank,input.season,session);
        const totalCirculating=balances.reduce((s,x)=>s+x.balance,0);
        for(const item of balances){await db.collection("opening_balances").updateOne({season:input.season+1,account_name:item.name,account_type:item.type},{$set:{balance:item.balance,source_season:input.season,created_at:new Date()}},{upsert:true,session});}
        await db.collection("opening_balances").updateOne({season:input.season+1,account_name:"Vreeo Bank",account_type:"bank"},{$set:{balance:bankBalance,source_season:input.season,created_at:new Date()}},{upsert:true,session});
        for(const m of memberRows){const name=String(m.row_data?.c1??"");if(!name)continue;await db.collection("admin_sheet_records").insertOne({sheet_key:"riwayat-season-individu",row_data:{c0:"",c1:String(input.season),c2:name,c3:String(m.row_data?.c3??""),c4:String(m.row_data?.c2??""),c5:String(m.row_data?.c6??""),c6:String(balances.find(x=>x.name===name)?.balance??0),c7:String(m.row_data?.c3??""),c8:String(m.row_data?.c2??""),c9:String(m.row_data?.c6??"")},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});}
        if(input.championPremio||input.championZwei){await db.collection("admin_sheet_records").insertOne({sheet_key:"hall-of-fame",row_data:{c0:String(input.season),c1:String(input.championPremio??""),c2:String(input.championZwei??"")},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});}
        await db.collection("admin_sheet_records").insertOne({sheet_key:"riwayat-season-ekonomi",row_data:{c0:"",c1:String(input.season),c2:new Date().toISOString().slice(0,10),c3:String(memberRows.length),c4:String(totalCirculating),c5:String(bankBalance),c6:String(debts.reduce((s,x)=>s+Number(x.remaining??0),0))},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});
        await db.collection("season_economy_snapshots").insertOne({season:input.season,closed_at:new Date(),closed_by:adminId,member_count:memberRows.length,team_count:teamRows.length,total_circulating:totalCirculating,bank_balance:bankBalance,active_debt:debts.reduce((s,x)=>s+Number(x.remaining??0),0),balances,ruleset_snapshot:rules},{session});
        await db.collection("economy_rulesets").updateOne({season:input.season},{$set:{status:"closed",closed_at:new Date(),closed_by:adminId}},{session});
        result={...result,memberCount:memberRows.length,teamCount:teamRows.length,totalCirculating,bankBalance,activeDebt:debts.reduce((s,x)=>s+Number(x.remaining??0),0)};
      } else if(action==="team_registration"){
        if(!rules.enabledWorkflows.teamRegistration)throw new Error("Registrasi tim dinonaktifkan.");
        const name=String(input.teamName??"").trim(),division=String(input.division??"");
        const ownerName=String(input.ownerName??"").trim(),engineName=String(input.engineName??"").trim();
        if(!name||!ownerName||!["Premio","Zwei","Caleris Trees"].includes(division))throw new Error("Nama tim, Owner, dan divisi wajib valid.");
        const teams=await db.collection("admin_sheet_records").find({sheet_key:"data-tim"},{session}).toArray();
        if(teams.some(x=>String(x.row_data?.c0??"").toLowerCase()===name.toLowerCase()))throw new Error("Nama tim sudah digunakan.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const owner=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===ownerName.toLowerCase()&&String(x.row_data?.c3??"")==="Owner");
        if(!owner)throw new Error("Owner aktif tidak ditemukan.");
        const fee=money(input.amount??rules.teamRegistrationFees[division]),roleFee=money(input.ownerRoleFee??rules.roleUpgradeFees.Owner??0),total=fee+roleFee;
        await add(driver(ownerName),"Keluar","Registrasi Tim",total,"Registrasi "+name+" ("+division+") dan biaya role Owner");
        await add(bank,"Masuk","Registrasi Tim",total,"Biaya registrasi tim "+name);
        await db.collection("admin_sheet_records").insertOne({sheet_key:"data-tim",row_data:{c0:name,c1:new ObjectId().toString(),c2:division,c3:engineName,c4:new Date().toISOString().slice(0,10),c5:"Aktif",c6:ownerName,c7:"",c8:"",c9:"1",c10:"0",c11:"",c12:"",c13:"Tidak"},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});
        await db.collection("admin_sheet_records").updateOne({_id:owner._id},{$set:{"row_data.c2":name,updated_at:new Date(),updated_by:adminId}},{session});
        result={...result,team:name,division,owner:ownerName,registrationFee:fee,ownerRoleFee:roleFee,total};
      } else if(action==="role_upgrade"){
        if(!rules.enabledWorkflows.roleUpgrade)throw new Error("Upgrade role dinonaktifkan.");
        const memberName=String(input.memberName??"").trim(),newRole=String(input.newRole??"").trim();
        if(!memberName||!["Driver","Owner","FIA"].includes(newRole))throw new Error("Role tujuan tidak valid. Role aktif: Driver, Owner, FIA.");
        if(input.confirmOffSeason!==true)throw new Error("Perubahan role hanya boleh diproses pada off-season dan perlu konfirmasi Admin.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const member=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===memberName.toLowerCase());
        if(!member)throw new Error("Anggota tidak ditemukan.");
        const oldRole=String(member.row_data?.c3??"");
        if(oldRole==="Admin")throw new Error("Role Admin tidak dapat dibeli atau diturunkan.");
        if(oldRole==="FIA"&&newRole!=="FIA")throw new Error("Role FIA permanen dan tidak dapat di-downgrade.");
        if(oldRole===newRole)throw new Error("Anggota sudah memiliki role tersebut.");
        const fee=money(input.amount??rules.roleUpgradeFees[newRole]??0);
        if(fee<=0)throw new Error("Biaya upgrade role belum dikonfigurasi.");
        await add(driver(memberName),"Keluar","Upgrade Role",fee,"Upgrade role "+oldRole+" ke "+newRole);
        await add(bank,"Masuk","Upgrade Role",fee,"Biaya upgrade role "+memberName);
        await db.collection("admin_sheet_records").updateOne({_id:member._id},{$set:{"row_data.c3":newRole,updated_at:new Date(),updated_by:adminId}},{session});
        result={...result,member:memberName,oldRole,newRole,fee};
      } else if(action==="engine_purchase"){
        if(!rules.enabledWorkflows.enginePurchase)throw new Error("Pembelian mesin dinonaktifkan.");
        const buyer=team(String(input.buyerTeam??"")),seller=team(String(input.sellerTeam??""));
        const engineName=String(input.engineName??"").trim(),price=money(input.amount);
        if(!engineName||buyer.name===seller.name||price<=0)throw new Error("Data pembelian mesin tidak valid.");
        const teamRows=await db.collection("admin_sheet_records").find({sheet_key:"data-tim"},{session}).toArray();
        const sellerRow=teamRows.find(x=>String(x.row_data?.c0??"")===seller.name),buyerRow=teamRows.find(x=>String(x.row_data?.c0??"")===buyer.name);
        if(!sellerRow||!buyerRow)throw new Error("Tim pembeli atau penjual tidak ditemukan.");
        if(String(sellerRow.row_data?.c3??"").trim()!==engineName)throw new Error("Mesin tidak tercatat sebagai mesin milik tim penjual.");
        if(String(buyerRow.row_data?.c3??"").trim())throw new Error("Tim pembeli sudah memiliki mesin.");
        if(await balance(db,buyer,input.season,session)<price)throw new Error("Saldo tim pembeli tidak cukup.");
        await add(buyer,"Keluar","Pembelian Mesin",price,"Pembelian "+engineName+" dari "+seller.name);
        await add(seller,"Masuk","Penjualan Mesin",price,"Penjualan "+engineName+" ke "+buyer.name);
        await db.collection("admin_sheet_records").updateOne({_id:buyerRow._id},{$set:{"row_data.c3":engineName,updated_at:new Date(),updated_by:adminId}},{session});
        result={...result,buyer:buyer.name,seller:seller.name,engine:engineName,price};
      } else if(action==="principal_evaluation"){
        const ownerName=String(input.ownerName??"").trim(),teamName=String(input.teamName??"").trim();
        const late=input.lateDriverData===true,inactive=money(input.inactiveDrivers??0),subsidy=money(input.subsidyAmount??rules.salary.ownerContribution);
        const exempt=input.exemptionApproved===true&&rules.inactive.principalExemptionEnabled;
        const reduction=(late||inactive>2)&&!exempt?Math.round(subsidy*0.2):0,payout=subsidy-reduction;
        if(!ownerName||!teamName||inactive<0)throw new Error("Data evaluasi Principal/Owner tidak valid.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const owner=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===ownerName.toLowerCase()&&String(x.row_data?.c2??"")===teamName);
        if(!owner)throw new Error("Owner tim tidak ditemukan.");
        if(await db.collection("economy_workflows").findOne({action:"principal_evaluation",season:input.season,"input.teamName":teamName,status:"posted"},{session}))throw new Error("Evaluasi subsidi tim untuk season ini sudah dicatat.");
        if(payout>0){await add(bank,"Keluar","Subsidi Tim (Evaluasi Principal)",payout,"Subsidi "+teamName+"; pengurangan "+reduction);await add(team(teamName),"Masuk","Subsidi Tim (Evaluasi Principal)",payout,"Subsidi setelah evaluasi "+ownerName);}
        await db.collection("admin_sheet_records").insertOne({sheet_key:"evaluasi-owner",row_data:{c0:"",c1:String(input.season),c2:ownerName,c3:late?"Ya":"Tidak",c4:String(inactive),c5:reduction?"Ya":"Tidak",c6:String(subsidy),c7:String(reduction),c8:exempt?"Pengecualian disetujui Admin":"Evaluasi berdasarkan data Admin",c9:teamName,c10:String(input.period)},sort_order:Date.now(),created_by:adminId,created_at:new Date()},{session});
        result={...result,owner:ownerName,team:teamName,subsidy,payout,reduction,exempt};
      } else if(action==="agent_commission"){
        const agentName=String(input.agentName??"").trim(),transferRef=String(input.transferReference??"").trim(),base=money(input.transferFee??0);
        if(!agentName||base<=0||!transferRef)throw new Error("Nama Agent, referensi transfer, dan biaya transfer wajib diisi.");
        if(await db.collection("economy_workflows").findOne({action:"agent_commission",season:input.season,"input.transferReference":transferRef,status:"posted"},{session}))throw new Error("Komisi untuk referensi transfer ini sudah dibayarkan.");
        const amount=Math.round(base*0.05);
        await add(bank,"Keluar","Komisi Agent (Legacy Delegation)",amount,"Komisi 5% transfer "+transferRef);
        await add(driver(agentName),"Masuk","Komisi Agent (Legacy Delegation)",amount,"Komisi transfer "+transferRef);
        result={...result,agent:agentName,transferReference:transferRef,commissionBase:base,rate:0.05,amount};
      } else if(action==="journalist_bonus"){
        const journalist=String(input.journalistName??"").trim(),contentId=String(input.contentId??"").trim(),views=money(input.views??0),invites=money(input.verifiedInvites??0);
        if(!journalist||!contentId||views<=rules.salary.journalistViewThreshold||invites<1)throw new Error("Bonus mensyaratkan konten >5.000 views dan minimal satu member referral terverifikasi.");
        if(await db.collection("economy_workflows").findOne({action:"journalist_bonus",season:input.season,"input.contentId":contentId,status:"posted"},{session}))throw new Error("Konten ini sudah pernah menerima bonus.");
        const amount=rules.salary.journalistViewBonus;
        await add(bank,"Keluar","Bonus Konten Jurnalis",amount,"Konten "+contentId+"; "+views+" views; "+invites+" referral valid");
        await add(driver(journalist),"Masuk","Bonus Konten Jurnalis",amount,"Bonus konten "+contentId);
        result={...result,journalist,contentId,views,verifiedInvites:invites,amount};
      } else if(action==="fia_performance_bonus"){
        const fiaName=String(input.memberName??"").trim(),amount=money(input.amount);
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const fia=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===fiaName.toLowerCase()&&String(x.row_data?.c3??"")==="FIA");
        if(!fia||amount<=0)throw new Error("Anggota FIA atau nominal bonus tidak valid.");
        if(await db.collection("economy_workflows").findOne({action:"fia_performance_bonus",season:input.season,"input.memberName":fiaName,status:"posted"},{session}))throw new Error("Bonus performa FIA season ini sudah dibayarkan.");
        await add(bank,"Keluar","Bonus Performa FIA",amount,"Bonus performa FIA Season "+input.season);
        await add(driver(fiaName),"Masuk","Bonus Performa FIA",amount,"Bonus evaluasi Admin");
        result={...result,fia:fiaName,amount};
      } else if(action==="daily_reward"){
        const memberName=String(input.memberName??"").trim(),rewardType=String(input.rewardType??"");
        const allowed=["Daily Check-in","Poster After-Race (Driver)","Poster Sosmed (Driver)"],amount=money(rules.tariffs[rewardType]??0);
        if(!memberName||!allowed.includes(rewardType)||amount<=0)throw new Error("Jenis reward atau tarif tidak valid.");
        const members=await db.collection("admin_sheet_records").find({sheet_key:"daftar-anggota"},{session}).toArray();
        const member=members.find(x=>String(x.row_data?.c1??"").toLowerCase()===memberName.toLowerCase()&&String(x.row_data?.c3??"")==="Driver");
        if(!member)throw new Error("Reward ini hanya untuk Driver aktif.");
        const day=String(input.date??new Date().toISOString().slice(0,10));
        if(await db.collection("economy_workflows").findOne({action:"daily_reward",season:input.season,"input.memberName":memberName,"input.rewardType":rewardType,"input.date":day,status:"posted"},{session}))throw new Error("Reward jenis ini sudah diklaim hari ini.");
        await add(bank,"Keluar",rewardType,amount,"Reward "+memberName+" tanggal "+day);
        await add(driver(memberName),"Masuk",rewardType,amount,"Reward aktivitas Driver");
        result={...result,member:memberName,rewardType,amount,date:day};
      } else if(action==="manual_pair"){
        const fromType=input.fromType==="bank"?"bank":input.fromType==="team"?"team":"individual";
        const toType=input.toType==="bank"?"bank":input.toType==="team"?"team":"individual";
        const from:Account={name:String(input.fromName??""),type:fromType},to:Account={name:String(input.toName??""),type:toType},amount=money(input.amount);
        if(from.name===to.name&&from.type===to.type)throw new Error("Akun asal dan tujuan tidak boleh sama.");
        if(amount<=0)throw new Error("Nominal harus lebih besar dari nol.");
        if(await balance(db,from,input.season,session)<amount)throw new Error("Saldo sumber tidak cukup.");
        await add(from,"Keluar",String(input.category??"Transfer Internal"),amount,String(input.description??""));
        await add(to,"Masuk",String(input.category??"Transfer Internal"),amount,String(input.description??""));
        result={...result,from:from.name,to:to.name,amount};
      } else {
        throw new Error("Workflow belum dikenal.");
      }

      for(const entry of entries){
        if(entry.amount<=0)throw new Error("Nominal transaksi harus positif.");
        if(entry.direction==="Keluar"&&entry.account.type!=="bank"){
          const available=await balance(db,entry.account,input.season,session);
          if(available<entry.amount)throw new Error("Saldo "+entry.account.name+" tidak cukup.");
          if(entry.account.type==="team"&&action!=="reverse_workflow"){
            const teamRows=await db.collection("admin_sheet_records").find({sheet_key:"transaksi","row_data.c2":entry.account.name,"row_data.c9":String(input.season),voided:{$ne:true}},{session}).toArray();
            const income=teamRows.reduce((sum,row)=>sum+(row.row_data?.c3==="Masuk"?money(row.row_data?.c6):0),0);
            const expenses=teamRows.reduce((sum,row)=>sum+(row.row_data?.c3==="Keluar"?money(row.row_data?.c6):0),0);
            if(income<=0||expenses+entry.amount>Math.floor(income*rules.teamExpenseLimitRate))throw new Error("Transaksi ditolak: batas pengeluaran tim "+(rules.teamExpenseLimitRate*100)+"% dari income season terlampaui.");
          }
        }
        if(entry.account.type==="bank"){
          const bankBalance=await balance(db,entry.account,input.season,session);
          const next=bankBalance+(entry.direction==="Masuk"?entry.amount:-entry.amount);
          if(next<0)throw new Error("Saldo Vreeo Bank tidak mencukupi.");
          await db.collection("economy_accounts").updateOne({account_key:"vreeo-bank"},{$set:{balance:next,updated_at:new Date()},$setOnInsert:{created_at:new Date()}},{upsert:true,session});
        }
        await writeEntry(db,session,adminId,entry.account,entry.direction,entry.category,entry.amount,input,entry.description??"",refId);
      }
      await db.collection("economy_workflows").insertOne({reference_id:refId,action,season:input.season,period:input.period,input,summary:result,created_by:adminId,created_at:new Date(),status:"posted"},{session});
    });
  } finally { await session.endSession(); }
  return result;
}
