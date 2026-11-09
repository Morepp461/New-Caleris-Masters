import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { executeEconomyWorkflow } from "@/lib/economy-workflows";\nimport { getDatabase } from "@/lib/mongodb";

export const runtime="nodejs";
export async function GET(request:NextRequest){
 const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const season=Number(request.nextUrl.searchParams.get("season")??1);
 if(!Number.isInteger(season)||season<1)return NextResponse.json({error:"Season tidak valid."},{status:400});
 const db=await getDatabase();
 const loans=await db.collection("bank_loans").find({status:{$in:["active","overdue"]}}).sort({created_at:-1}).limit(200).toArray();
 return NextResponse.json({loans:loans.map(x=>({id:String(x._id),team:x.team,principal:x.principal,remaining:x.remaining,season:x.season,duePeriod:x.due_period,status:x.status,referenceId:x.reference_id}))});
}
export async function POST(request:NextRequest){
 const admin=await getCurrentAdmin();if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return NextResponse.json({error:"Payload tidak valid."},{status:400});
 try{const result=await executeEconomyWorkflow(body,admin.id);return NextResponse.json({success:true,result},{status:201});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Workflow gagal."},{status:400});}
}