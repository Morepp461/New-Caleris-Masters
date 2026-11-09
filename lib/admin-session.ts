import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "caleris_admin_session";
const SESSION_DAYS = 7;

type AdminUser = { _id:ObjectId; email:string; displayName:string; role:"admin"; passwordHash:string; passwordSalt:string; createdAt:Date };
type AdminSession = { _id:ObjectId; userId:ObjectId; tokenHash:string; expiresAt:Date; createdAt:Date };

function hashToken(token:string){return createHash("sha256").update(token).digest("hex");}
async function verifyPassword(password:string,salt:string,expected:string){
 const derived=await scrypt(password,salt,64) as Buffer;
 const stored=Buffer.from(expected,"hex");
 return stored.length===derived.length&&timingSafeEqual(stored,derived);
}
async function ensureBootstrapAdmin(){
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 const password=process.env.ADMIN_PASSWORD;
 if(!email||!password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured.");
 const db=await getDatabase();
 const users=db.collection<AdminUser>("admin_users");
 const existing=await users.findOne({email});
 if(existing)return existing;
 const anyAdmin=await users.findOne({role:"admin"});
 if(anyAdmin)throw new Error("Bootstrap admin already exists. Use the existing administrator account.");
 const salt=randomBytes(16).toString("hex");
 const passwordHash=(await scrypt(password,salt,64) as Buffer).toString("hex");
 const result=await users.insertOne({email,displayName:process.env.ADMIN_DISPLAY_NAME?.trim()||"Administrator",role:"admin",passwordHash,passwordSalt:salt,createdAt:new Date()} as Omit<AdminUser,"_id">);
 return users.findOne({_id:result.insertedId});
}

export async function authenticateAdmin(emailInput:string,password:string){
 const db=await getDatabase();
 const email=emailInput.trim().toLowerCase();
 const users=db.collection<AdminUser>("admin_users");
 let user=await users.findOne({email});
 if(!user && !(await users.findOne({role:"admin"}))) user=await ensureBootstrapAdmin();
 if(!user||user.email!==email||user.role!=="admin")return null;
 if(!(await verifyPassword(password,user.passwordSalt,user.passwordHash)))return null;
 const token=randomBytes(32).toString("base64url");
 const expiresAt=new Date(Date.now()+SESSION_DAYS*24*60*60*1000);
 await db.collection<AdminSession>("admin_sessions").insertOne({_id:new ObjectId(),userId:user._id,tokenHash:hashToken(token),expiresAt,createdAt:new Date()});
 const cookieStore=await cookies();
 cookieStore.set(COOKIE_NAME,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:expiresAt});
 return {id:user._id.toString(),email:user.email,displayName:user.displayName};
}

export async function getCurrentAdmin(){
 const cookieStore=await cookies();
 const token=cookieStore.get(COOKIE_NAME)?.value;
 if(!token)return null;
 const db=await getDatabase();
 const session=await db.collection<AdminSession>("admin_sessions").findOne({tokenHash:hashToken(token),expiresAt:{$gt:new Date()}});
 if(!session)return null;
 const user=await db.collection<AdminUser>("admin_users").findOne({_id:session.userId,role:"admin"},{projection:{passwordHash:0,passwordSalt:0}});
 if(!user)return null;
 return {id:user._id.toString(),email:user.email,displayName:user.displayName};
}

export async function destroyCurrentAdminSession(){
 const cookieStore=await cookies();
 const token=cookieStore.get(COOKIE_NAME)?.value;
 if(token){
  const db=await getDatabase();
  await db.collection<AdminSession>("admin_sessions").deleteOne({tokenHash:hashToken(token)});
 }
 cookieStore.delete(COOKIE_NAME);
}
