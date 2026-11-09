import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSheet } from "@/lib/admin-sheets";

async function adminContext(){
 const supabase=await createClient();if(!supabase)return {error:NextResponse.json({error:"Supabase belum dikonfigurasi."},{status:503})};
 const {data}=await supabase.auth.getClaims();const userId=data?.claims?.sub;
 if(!userId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
 const {data:profile}=await supabase.from("member_profiles").select("role").eq("user_id",String(userId)).maybeSingle();
 if(profile?.role!=="admin")return {error:NextResponse.json({error:"Admin access required."},{status:403})};
 return {supabase,userId:String(userId)};
}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{sheet:string;id:string}>}){
 const {sheet,id}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly)return NextResponse.json({error:"Sheet ini bersifat read-only."},{status:403});
 const ctx=await adminContext();if("error" in ctx)return ctx.error;
 const body=await request.json().catch(()=>null);if(!body||typeof body.row_data!=="object"||Array.isArray(body.row_data))return NextResponse.json({error:"Format data tidak valid."},{status:400});
 const allowed=new Set(definition.columns.map((_,i)=>`c${i}`).filter(key=>!definition.readonlyColumns?.includes(Number(key.slice(1)))));
 const row_data=Object.fromEntries(Object.entries(body.row_data).filter(([key])=>allowed.has(key)));
 const {data,error}=await (ctx.supabase as any).from("admin_sheet_records").update({row_data,updated_by:ctx.userId,updated_at:new Date().toISOString()}).eq("id",id).eq("sheet_key",sheet).select("id").maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});if(!data)return NextResponse.json({error:"Record tidak ditemukan."},{status:404});
 return NextResponse.json({success:true});
}
export async function DELETE(_request:NextRequest,{params}:{params:Promise<{sheet:string;id:string}>}){
 const {sheet,id}=await params;const definition=getAdminSheet(sheet);if(!definition)return NextResponse.json({error:"Sheet tidak ditemukan."},{status:404});
 if(definition.readOnly)return NextResponse.json({error:"Sheet ini bersifat read-only."},{status:403});
 const ctx=await adminContext();if("error" in ctx)return ctx.error;
 const {data,error}=await (ctx.supabase as any).from("admin_sheet_records").delete().eq("id",id).eq("sheet_key",sheet).select("id").maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});if(!data)return NextResponse.json({error:"Record tidak ditemukan."},{status:404});
 return NextResponse.json({success:true});
}
