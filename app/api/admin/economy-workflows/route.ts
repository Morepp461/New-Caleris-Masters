import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { executeEconomyWorkflow } from "@/lib/economy-workflows";

export const runtime="nodejs";
export async function POST(request:NextRequest){
 const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return NextResponse.json({error:"Payload tidak valid."},{status:400});
 try{const result=await executeEconomyWorkflow(body,admin.id);return NextResponse.json({success:true,result},{status:201});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Workflow gagal."},{status:400});}
}