import { NextRequest,NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";
import { getRuleset } from "@/lib/economy-rules";

export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,{params}:Ctx){
 const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;if(!ObjectId.isValid(id))return NextResponse.json({error:"ID transaksi tidak valid."},{status:400});
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return NextResponse.json({error:"Payload tidak valid."},{status:400});
 const db=await getDatabase(),collection=db.collection("admin_sheet_records"),_id=new ObjectId(id);
 const current=await collection.findOne({_id,sheet_key:"transaksi"});if(!current)return NextResponse.json({error:"Transaksi tidak ditemukan."},{status:404});
 if(current.workflow_generated)return NextResponse.json({error:"Jurnal yang dihasilkan workflow harus dikoreksi melalui pembatalan seluruh workflow menggunakan Reference ID."},{status:409});
 const fields=["c1","c2","c3","c4","c5","c6","c7","c8","c9"];
 const row={...(current.row_data??{})} as Record<string,string>;
 for(const key of fields)if(body.row_data?.[key]!==undefined)row[key]=String(body.row_data[key]);
 if(!row.c2?.trim()||!row.c4?.trim()||!["Masuk","Keluar"].includes(row.c3)||!Number.isFinite(Number(row.c6))||Number(row.c6)<=0||!Number.isInteger(Number(row.c7))||Number(row.c7)<1||!Number.isInteger(Number(row.c9))||Number(row.c9)<1)return NextResponse.json({error:"Detail transaksi tidak valid."},{status:400});
 const rules=await getRuleset(Number(row.c9));
 if(rules.status==="closed")return NextResponse.json({error:"Season sudah ditutup. Jurnal tidak dapat diedit."},{status:409});
 const amount=Number(row.c6),oldAmount=Number(current.row_data?.c6??0),direction=row.c3;
 const accountType=current.account_type==="team"?"team":current.account_type==="bank"?"bank":"individual";
 if(accountType!=="bank"){
  const otherRows=await collection.find({sheet_key:"transaksi","row_data.c2":row.c2,"row_data.c9":row.c9,voided:{$ne:true},_id:{$ne:_id}}).toArray();
  const balance=otherRows.reduce((sum,item)=>sum+(item.row_data?.c3==="Masuk"?Number(item.row_data?.c6??0):item.row_data?.c3==="Keluar"?-Number(item.row_data?.c6??0):0),0);
  if(direction==="Keluar"&&balance<amount)return NextResponse.json({error:"Saldo akun tidak cukup untuk perubahan transaksi ini."},{status:409});
  if(accountType==="team"&&direction==="Keluar"){
   const income=otherRows.reduce((sum,item)=>sum+(item.row_data?.c3==="Masuk"?Number(item.row_data?.c6??0):0),0);
   const expenses=otherRows.reduce((sum,item)=>sum+(item.row_data?.c3==="Keluar"?Number(item.row_data?.c6??0):0),0);
   if(income<=0||expenses+amount>Math.floor(income*rules.teamExpenseLimitRate))return NextResponse.json({error:"Perubahan melanggar batas pengeluaran tim 80% dari income season."},{status:409});
  }
 }
 if(current.workflow_generated)return NextResponse.json({error:"Jurnal workflow harus dibatalkan sebagai satu kesatuan."},{status:409});
 const now=new Date();
 await collection.updateOne({_id,sheet_key:"transaksi"},{$set:{row_data:row,updated_at:now,updated_by:admin.id,admin_edited:true}});
 await db.collection("audit_logs").insertOne({action:"ledger.transaction.edited",actor_id:admin.id,target_id:id,metadata:{before:current.row_data,after:row,workflowReference:current.reference_id??null},created_at:now});
 return NextResponse.json({success:true,record:{id,row_data:row}});
}
export async function DELETE(_request:NextRequest,{params}:Ctx){
 const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;if(!ObjectId.isValid(id))return NextResponse.json({error:"ID transaksi tidak valid."},{status:400});
 const db=await getDatabase(),collection=db.collection("admin_sheet_records"),_id=new ObjectId(id);
 const current=await collection.findOne({_id,sheet_key:"transaksi"});if(!current)return NextResponse.json({error:"Transaksi tidak ditemukan."},{status:404});
 if(current.workflow_generated)return NextResponse.json({error:"Jurnal workflow tidak dapat dibatalkan satu per satu. Gunakan pembatalan workflow dengan Reference ID."},{status:409});
 const now=new Date();
 await collection.updateOne({_id},{$set:{voided:true,voided_at:now,voided_by:admin.id,updated_at:now}});
 await db.collection("audit_logs").insertOne({action:"ledger.transaction.voided",actor_id:admin.id,target_id:id,metadata:{before:current.row_data,workflowReference:current.reference_id??null},created_at:now});
 return NextResponse.json({success:true});
}