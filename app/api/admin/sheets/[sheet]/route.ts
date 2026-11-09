import { NextRequest,NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { getDatabase } from "@/lib/mongodb";
import { getAdminSheet } from "@/lib/admin-sheets";
import { ObjectId } from "mongodb";
export const runtime="nodejs";
async function authorized(){const admin=await getCurrentAdmin();return admin;}
export async function GET(_request:NextRequest,{params}:{params:Promise<{sheet:string}>}){
 const admin=await authorized();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {sheet}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 const db=await getDatabase();
 const records=await db.collection("admin_sheet_records").find({sheet_key:sheet}).sort({sort_order:1,created_at:-1}).limit(500).toArray();
 return NextResponse.json({records:records.map(r=>({...r,id:(r._id as ObjectId).toString(),_id:undefined}))});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{sheet:string}>}){
 const admin=await authorized();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {sheet}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly)return NextResponse.json({error:"Sheet ini bersifat read-only."},{status:403});
 const body=await request.json().catch(()=>null);if(!body||typeof body.row_data!=="object"||Array.isArray(body.row_data))return NextResponse.json({error:"Format data tidak valid."},{status:400});
 const allowed=new Set(definition.columns.map((_,i)=>`c${i}`).filter(key=>!definition.readonlyColumns?.includes(Number(key.slice(1)))));
 const row_data=Object.fromEntries(Object.entries(body.row_data).filter(([key])=>allowed.has(key)));
 const db=await getDatabase();const now=new Date();
 const result=await db.collection("admin_sheet_records").insertOne({sheet_key:sheet,row_data,sort_order:0,created_by:admin.id,updated_by:admin.id,created_at:now,updated_at:now});
 return NextResponse.json({record:{id:result.insertedId.toString(),row_data,created_at:now,updated_at:now}},{status:201});
}
