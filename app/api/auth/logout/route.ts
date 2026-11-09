import { NextResponse } from "next/server";
import { destroyCurrentAdminSession } from "@/lib/admin-session";

export async function POST(){
 await destroyCurrentAdminSession();
 return NextResponse.json({success:true});
}
