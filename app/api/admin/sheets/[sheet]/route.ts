import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSheet } from "@/lib/admin-sheets";

async function adminContext(){
 const supabase=await createClient();
 if(!supabase)return {error:NextResponse.json({error:"Supabase belum dikonfigurasi."},{status:503})};
 const {data}=await supabase.auth.getClaims();
 const userId=data?.claims?.sub;
 if(!userId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
 const {data:profile}=await supabase.from("member_profiles").select("role").eq("user_id",String(userId)).maybeSingle();
 if(profile?.role!=="admin")return {error:NextResponse.json({error:"Admin access required."},{status:403})};
 return {supabase,userId:String(userId)};
}
export async function GET(_request:NextRequest,{params}:{params:Promise<{sheet:string}>}){
 const {sheet}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 const ctx=await adminContext();if("error" in ctx)return ctx.error;
 const {data,error}=await (ctx.supabase as any).from("admin_sheet_records").select("id,row_data,created_at,updated_at").eq("sheet_key",sheet).order("sort_order",{ascending:true}).order("created_at",{ascending:false}).limit(500);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({records:data??[]});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{sheet:string}>}){
 const {sheet}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly)return NextResponse.json({error:"Sheet ini bersifat read-only."},{status:403});
 const ctx=await adminContext();if("error" in ctx)return ctx.error;
 const body=await request.json().catch(()=>null);if(!body||typeof body.row_data!=="object"||Array.isArray(body.row_data))return NextResponse.json({error:"Format data tidak valid."},{status:400});
 const allowed=new Set(definition.columns.map((_,i)=>`c${i}`).filter(key=>!definition.readonlyColumns?.includes(Number(key.slice(1)))));
 const row_data=Object.fromEntries(Object.entries(body.row_data).filter(([key])=>allowed.has(key)));
 const {data,error}=await (ctx.supabase as any).from("admin_sheet_records").insert({sheet_key:sheet,row_data,created_by:ctx.userId,updated_by:ctx.userId}).select("id,row_data,created_at,updated_at").single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({record:data},{status:201});
}
