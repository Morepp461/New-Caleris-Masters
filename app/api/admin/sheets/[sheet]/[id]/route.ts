import { NextRequest,NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";
import { getAdminSheet } from "@/lib/admin-sheets";
import { ObjectId } from "mongodb";
export const runtime="nodejs";
async function authorized(){return getCurrentAdmin();}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{sheet:string;id:string}>}){
 const admin=await authorized();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {sheet,id}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly||sheet==="transaksi")return NextResponse.json({error:sheet==="transaksi"?"Jurnal transaksi tidak boleh diedit atau dihapus. Buat transaksi koreksi melalui mesin transaksi.":"Sheet ini bersifat read-only."},{status:403});
 if(!ObjectId.isValid(id))return NextResponse.json({error:"ID tidak valid."},{status:400});
 const body=await request.json().catch(()=>null);if(!body||typeof body.row_data!=="object"||Array.isArray(body.row_data))return NextResponse.json({error:"Format data tidak valid."},{status:400});
 const allowed=new Set(definition.columns.map((_,i)=>`c${i}`).filter(key=>!definition.readonlyColumns?.includes(Number(key.slice(1)))));
 const row_data=Object.fromEntries(Object.entries(body.row_data).filter(([key])=>allowed.has(key)));
 const db=await getDatabase();const result=await db.collection("admin_sheet_records").updateOne({_id:new ObjectId(id),sheet_key:sheet},{$set:{row_data,updated_by:admin.id,updated_at:new Date()}});
 if(!result.matchedCount)return NextResponse.json({error:"Record tidak ditemukan."},{status:404});
 return NextResponse.json({success:true});
}
export async function DELETE(_request:NextRequest,{params}:{params:Promise<{sheet:string;id:string}>}){
 const admin=await authorized();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {sheet,id}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly)return NextResponse.json({error:"Sheet ini bersifat read-only."},{status:403});
 if(!ObjectId.isValid(id))return NextResponse.json({error:"ID tidak valid."},{status:400});
 const db=await getDatabase();const result=await db.collection("admin_sheet_records").deleteOne({_id:new ObjectId(id),sheet_key:sheet});
 if(!result.deletedCount)return NextResponse.json({error:"Record tidak ditemukan."},{status:404});
 return NextResponse.json({success:true});
}
