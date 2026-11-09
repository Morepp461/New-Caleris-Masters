import { NextRequest,NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/admin-session";

export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  if(typeof body.email!=="string"||typeof body.password!=="string")return NextResponse.json({error:"Email dan password wajib diisi."},{status:400});
  const admin=await authenticateAdmin(body.email,body.password);
  if(!admin)return NextResponse.json({error:"Email atau password tidak valid."},{status:401});
  return NextResponse.json({success:true,admin});
 }catch(error){
  const message=error instanceof Error?error.message:"Login gagal.";
  return NextResponse.json({error:message},{status:500});
 }
}
